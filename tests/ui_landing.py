import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page():
            pg=await (await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)).new_page()
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
        # first visit
        a=await page(); await a.goto(BASE); await a.wait_for_timeout(400); await a.screenshot(path='l1_first.png')
        print('first visit shows name step only:', await a.is_visible('#nameStep'), not await a.is_visible('#menu'))
        await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.wait_for_timeout(400)
        print('menu after name:', await a.is_visible('#menu'), '| hello:', await a.text_content('#helloName'))
        await a.screenshot(path='l2_menu.png', full_page=True)
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        # invited newcomer
        n=await page(); await n.goto(BASE+'?room='+code); await n.wait_for_timeout(500); await n.screenshot(path='l3_invited.png')
        print('invite text:', await n.text_content('#nameInvite'), '| button:', await n.text_content('#nameGo'))
        await n.fill('#nameInput','Priya'); await n.click('#nameGo'); await n.wait_for_selector('#lobby:not(.hidden)'); print('invited newcomer joined in one tap: True')
        # returning player with a link
        r=await page(); await r.goto(BASE); await r.fill('#nameInput','Kiran'); await r.click('#nameGo'); await r.wait_for_timeout(300)
        await r.goto(BASE+'?room='+code); await r.wait_for_timeout(700)
        print('returning player invite card:', await r.is_visible('#inviteCard'), '|', await r.text_content('#inviteInfo'))
        await r.screenshot(path='l4_return_invite.png')
        await r.click('#inviteJoin'); await r.wait_for_selector('#lobby:not(.hidden)'); print('joined from card: True')
        # leave -> back to menu, invite gone
        await r.click('#leaveBtn'); await r.wait_for_selector('#home:not(.hidden)'); await r.wait_for_timeout(300)
        print('after leave: menu', await r.is_visible('#menu'), '| invite card hidden', not await r.is_visible('#inviteCard'), '| room listed', await r.locator('#roomList li').count())
        # change name
        await r.click('#editName'); print('edit shows Save:', await r.text_content('#nameGo')); await r.fill('#nameInput','Kiran K'); await r.click('#nameGo'); print('new hello:', await r.text_content('#helloName'))
        print('errors', errs); await b.close()
asyncio.run(main())
