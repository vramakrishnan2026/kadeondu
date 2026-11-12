import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
async def newpage(b):
    ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        a=await newpage(b); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        print('default timer:', await a.input_value('#turnTimeInput'))
        await a.select_option('#turnTimeInput','10'); await a.wait_for_timeout(200)
        code=(await a.text_content('#lobbyCode')).strip()
        q=await newpage(b); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        print('guest sees:', await q.text_content('#guestSettings'))
        await a.click('#startBtn'); await q.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(2500)
        print('status A:', await a.text_content('#status'), '| clock rings:', await a.locator('#seats .clock').count())
        await a.screenshot(path='t_clock.png')
        # nobody moves: wait for two timeouts
        log=[]
        for _ in range(26):
            await a.wait_for_timeout(1000); t=await a.text_content('#logLine')
            if not log or log[-1]!=t: log.append(t)
        print('log while idle:', log)
        # solo with 10s
        s=await newpage(b); await s.goto(BASE); await s.fill('#nameInput','Vinay'); await s.click('#nameGo'); await s.click('#soloBtn'); await s.select_option('#soloCount','1'); await s.select_option('#soloTime','10'); await s.click('#soloStart')
        await s.wait_for_selector('#game:not(.hidden)')
        for _ in range(30):
            if 'mine' in (await s.get_attribute('#status','class') or ''): break
            await s.wait_for_timeout(300)
        n0=await s.locator('#hand .card').count(); await s.wait_for_timeout(11500)
        print('solo idle: hand before', n0, 'log:', await s.text_content('#logLine'), '| toast:', await s.text_content('#toast'))
        print('errors', errs); await b.close()
asyncio.run(main())
