# Voice notes and emoji reactions on the Ludo screen (the same buttons as the card game, moved under the board).
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        errs=[]
        async def page(n):
            ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, permissions=['microphone'])
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        a=await page('A'); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('.game-tab >> nth=1'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        code=(await a.text_content('#lobbyCode')).strip()
        q=await page('Q'); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        await a.check('#reactionsInput'); await a.wait_for_timeout(200)
        await a.click('#startBtn'); await q.wait_for_selector('#ludo:not(.hidden)'); await a.wait_for_timeout(500)
        print('on the Ludo screen: mic', await a.is_visible('#micBtn'), '| mute', await a.is_visible('#muteBtn'), '| reactions', await a.is_visible('#reactBtn'), '| mic is', round((await a.locator('#micBtn').bounding_box())['width']), 'px')
        await q.evaluate("window.__voices=0; const P=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ if((this.src||'').startsWith('data:audio')){window.__voices++; window.__len=this.src.length;} return P.call(this)}; 0")
        box=await a.locator('#micBtn').bounding_box()
        await a.mouse.move(box['x']+20, box['y']+20); await a.mouse.down(); await a.wait_for_timeout(700)
        print('recording:', 'rec' in (await a.get_attribute('#micBtn','class')))
        await a.wait_for_timeout(900); await a.mouse.up(); await a.wait_for_timeout(1200)
        print('sender toast:', await a.text_content('#toast'), '| Priya heard voice notes:', await q.evaluate('window.__voices'), '| size', await q.evaluate('window.__len'), '| bubble', await q.locator('.voice-bubble').count())
        await q.click('#muteBtn'); await a.wait_for_timeout(2700)
        await a.mouse.down(); await a.wait_for_timeout(800); await a.mouse.up(); await a.wait_for_timeout(1200)
        print('after Priya mutes (still 1):', await q.evaluate('window.__voices'))
        # reactions: tray of 8 emoji, both see the float; a watcher can react too
        await q.click('#reactBtn'); print('tray emoji:', await q.locator('#reactTray .react-pick').count(), end=' | ')
        await q.click('#reactTray .react-pick >> nth=7'); await a.wait_for_timeout(500)
        print('Arun sees', await a.locator('.react-float.main').count(), await a.text_content('.react-float.main .react-who'), '| Priya sees', await q.text_content('.react-float.main .react-who'))
        # the game still plays while all that goes on
        await a.click('#ludoRoll'); await a.wait_for_timeout(1800); print('rolled:', await a.get_attribute('#ludoDie','data-v') in list('123456'))
        # back in a card-game room, the same buttons are back under the card table
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); await a.click('.game-tab >> nth=0'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        await a.click('#addBotBtn'); await a.wait_for_timeout(200); await a.click('#startBtn'); await a.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(300)
        print('card game after Ludo: buttons row under', await a.evaluate("document.querySelector('.act-side').parentNode.id"), '| mic', await a.is_visible('#micBtn'), '| hand cards', await a.locator('#hand .card').count())
        print('errors', errs); await b.close()
asyncio.run(main())
