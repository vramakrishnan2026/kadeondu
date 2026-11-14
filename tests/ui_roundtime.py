# Round time limit ("End round after"): 3 min by default, Off / 3 / 5 / 7 / 10 min, countdown under the discard pile,
# lowest card points wins when it runs out. Needs the stand-in running (uses its /__test/roundends shortcut).
import asyncio, re, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
async def newpage(b):
    ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        a=await newpage(b); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        d=await a.input_value('#roundTimeInput'); print('default:', d); assert d=='3'
        print('options:', await a.locator('#roundTimeInput option').all_text_contents())
        code=(await a.text_content('#lobbyCode')).strip()
        q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        g=await q.text_content('#guestSettings'); print('guest (default):', g); assert 'round ends after 3 min' in g
        await a.select_option('#roundTimeInput','0'); await a.wait_for_timeout(300)
        g=await q.text_content('#guestSettings'); print('guest (off):', g); assert 'round ends' not in g
        await a.select_option('#roundTimeInput','10'); await a.wait_for_timeout(300)
        g=await q.text_content('#guestSettings'); print('guest (10 min):', g); assert 'round ends after 10 min' in g
        await a.select_option('#roundTimeInput','3'); await a.wait_for_timeout(300)
        await a.select_option('#turnTimeInput','0'); await a.click('#startBtn'); await q.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(1200)
        ca=(await a.text_content('#roundClock')).strip(); cq=(await q.text_content('#roundClock')).strip(); print('clocks:', ca, '|', cq)
        assert re.match(r'⏳ 2:5\d$', ca) and re.match(r'⏳ 2:5\d$', cq)
        fits=await a.evaluate("document.documentElement.scrollHeight<=innerHeight"); print('no scrolling:', fits); assert fits
        await a.screenshot(path='rt_clock.png')
        counts=await a.evaluate("[...document.querySelectorAll('#seats .seat')].map(x=>x.dataset.count)")
        urllib.request.urlopen(BASE+'__test/roundends?room='+code+'&ms=1500').read()
        await a.wait_for_timeout(700); print('last seconds:', (await a.text_content('#roundClock')).strip(), '| red:', 'hurry' in (await a.get_attribute('#roundClock','class')))
        await a.wait_for_selector('#endOverlay:not(.hidden)', timeout=5000); await q.wait_for_selector('#endOverlay:not(.hidden)', timeout=5000)
        ta=await a.text_content('#endTitle'); pa=await a.text_content('#endPoints'); print('host sees:', ta, '|', pa); print('guest sees:', await q.text_content('#endTitle'))
        assert "Time's up" in pa
        await a.screenshot(path='rt_end.png')
        print('clock cleared:', repr((await a.text_content('#roundClock')).strip()))
        await a.click('#nextRoundBtn'); await a.wait_for_timeout(1200)
        c2=(await a.text_content('#roundClock')).strip(); print('round 2 clock:', c2); assert re.match(r'⏳ 2:5\d$', c2)
        # solo: 5 min, jump the phone's clock forward, the next move ends the round
        s=await newpage(b); await s.clock.install(); await s.goto(BASE); await s.fill('#nameInput','Vinay'); await s.click('#nameGo'); await s.click('#soloBtn')
        print('solo default:', await s.input_value('#soloRoundTime'))
        await s.select_option('#soloCount','1'); await s.select_option('#soloTime','0'); await s.select_option('#soloRoundTime','5'); await s.click('#soloStart')
        await s.wait_for_selector('#game:not(.hidden)'); await s.wait_for_timeout(800)
        print('solo clock:', (await s.text_content('#roundClock')).strip())
        await s.clock.fast_forward(4*60*1000+50*1000)
        if await s.is_visible('#endOverlay'): print('solo: someone won before the limit (re-run)')
        else:
            print('solo clock after 4:50:', (await s.text_content('#roundClock')).strip())
            await s.clock.fast_forward(15*1000); await s.wait_for_timeout(500)
            print('solo end:', await s.is_visible('#endOverlay'), '|', await s.text_content('#endTitle'), '|', await s.text_content('#endPoints'))
        print('errors', errs); assert not errs; await b.close()
asyncio.run(main())
