import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page():
            x=await (await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2)).new_page()
            x.on('pageerror', lambda e: errs.append(str(e))); return x
        a=await page(); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)')
        print('stickers off by default:', not await a.is_checked('#reactionsInput'))
        code=(await a.text_content('#lobbyCode')).strip()
        q=await page(); await q.goto(BASE+'?room='+code); await q.fill('#nameInput','Priya'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
        await a.select_option('#turnTimeInput','0'); await a.click('#startBtn'); await q.wait_for_selector('#game:not(.hidden)'); await q.wait_for_timeout(300)
        print('button hidden when off:', not await q.is_visible('#reactBtn'))
        # sending while off is ignored by the server
        await q.evaluate("1"); 
        # turn on between rounds is host-only in lobby; use a fresh room flow: host toggles in lobby before start
        a2=await page(); await a2.goto(BASE); await a2.fill('#nameInput','Host2'); await a2.click('#nameGo'); await a2.click('#createBtn'); await a2.wait_for_selector('#lobby:not(.hidden)')
        await a2.check('#reactionsInput'); await a2.select_option('#turnTimeInput','0'); code2=(await a2.text_content('#lobbyCode')).strip()
        g=await page(); await g.goto(BASE+'?room='+code2); await g.fill('#nameInput','Guest2'); await g.click('#nameGo'); await g.wait_for_selector('#lobby:not(.hidden)')
        print('guest sees setting:', await g.text_content('#guestSettings'))
        await a2.click('#startBtn'); await g.wait_for_selector('#game:not(.hidden)'); await g.wait_for_timeout(300)
        print('button visible when on:', await g.is_visible('#reactBtn'))
        await g.click('#reactBtn'); await g.wait_for_timeout(200); await g.screenshot(path='react_tray.png')
        print('tray stickers:', await g.locator('#reactTray .react-pick').count())
        await g.locator('#reactTray .react-pick').nth(5).click(); await a2.wait_for_timeout(500)
        print('host sees pop:', await a2.locator('.react-float.main').count(), '| who:', await a2.locator('.react-float.main .react-who').first.text_content())
        await a2.screenshot(path='react_pop.png')
        print('sender sees own pop:', await g.locator('.react-float.main').count())
        await g.wait_for_timeout(2800); print('pop gone after ~3 s:', await g.locator('.react-float.main').count()==0)
        print('errors', errs); await b.close()
asyncio.run(main())
