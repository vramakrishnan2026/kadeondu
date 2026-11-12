import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        errs=[]
        async def page(n):
            ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, permissions=['microphone'])
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        a=await page('A'); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip()
        q=await page('Q'); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        await a.click('#startBtn'); await q.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(400)
        print('mic visible:', await a.is_visible('#micBtn'))
        await q.evaluate("window.__voices=0; const P=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ if((this.src||'').startsWith('data:audio')){window.__voices++; window.__len=this.src.length; window.__mime=this.src.slice(0,30);} return P.call(this)}; 0")
        box=await a.locator('#micBtn').bounding_box()
        await a.mouse.move(box['x']+20, box['y']+20); await a.mouse.down(); await a.wait_for_timeout(700)
        print('recording state:', 'rec' in (await a.get_attribute('#micBtn','class')))
        await a.screenshot(path='voice_rec.png')
        await a.wait_for_timeout(900); await a.mouse.up(); await a.wait_for_timeout(1200)
        print('sender toast:', await a.text_content('#toast'))
        print('guest got voice notes:', await q.evaluate('window.__voices'), 'size chars:', await q.evaluate('window.__len'), 'format:', await q.evaluate('window.__mime'), '| bubble:', await q.locator('.voice-bubble').count())
        # mute on guest
        await q.click('#muteBtn'); await a.wait_for_timeout(2700)
        await a.mouse.down(); await a.wait_for_timeout(800); await a.mouse.up(); await a.wait_for_timeout(1200)
        print('muted guest voices (still 1):', await q.evaluate('window.__voices'))
        # quick tap
        await a.wait_for_timeout(2600); await a.mouse.down(); await a.wait_for_timeout(100); await a.mouse.up(); await a.wait_for_timeout(500); print('quick tap toast:', await a.text_content('#toast'))
        print('errors', errs); await b.close()
asyncio.run(main())
