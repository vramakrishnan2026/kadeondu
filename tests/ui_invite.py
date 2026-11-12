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
        arun,priya,kiran,meera=[await newpage(b) for _ in range(4)]
        for pg,n in [(arun,'Arun'),(priya,'Priya'),(kiran,'Kiran'),(meera,'Meera')]:
            await pg.goto(BASE); await pg.fill('#nameInput',n); await pg.click('#nameGo')
        await arun.wait_for_timeout(800)
        print('arun online list:', [t.strip() for t in await arun.locator('#peopleHome .rname').all_text_contents()])
        await arun.screenshot(path='i_home.png')
        # Arun creates a room, invites Priya from the lobby modal
        await arun.click('#createBtn'); await arun.wait_for_selector('#lobby:not(.hidden)')
        await priya.wait_for_timeout(400)
        print('priya sees arun as:', (await priya.locator('#peopleHome li', has_text='Arun').text_content()).strip())
        await arun.click('#inviteLobbyBtn'); await arun.wait_for_selector('#peopleModal:not(.hidden)')
        await arun.locator('#peopleList li', has_text='Priya').locator('button').click()
        await priya.wait_for_selector('#inviteModal:not(.hidden)'); print('priya invite:', await priya.text_content('#inviteTitle'), '|', await priya.text_content('#inviteSub'))
        await priya.screenshot(path='i_invited.png')
        await arun.screenshot(path='i_modal.png')
        print('arun toast:', await arun.text_content('#toast'))
        await priya.click('#acceptInvite'); await priya.wait_for_selector('#lobby:not(.hidden)')
        print('arun lobby players:', [t for t in await arun.locator('#lobbyPlayers .name').all_text_contents()])
        # Kiran declines
        await arun.locator('#peopleList li', has_text='Kiran').locator('button').click()
        await kiran.wait_for_selector('#inviteModal:not(.hidden)'); await kiran.click('#declineInvite')
        await arun.wait_for_timeout(400); print('arun toast after decline:', await arun.text_content('#toast'))
        # Priya now in room: no invite button for her
        print('priya row buttons in arun modal:', await arun.locator('#peopleList li', has_text='Priya').locator('button').count(), (await arun.locator('#peopleList li', has_text='Priya').text_content()).strip())
        await arun.click('#closePeople')
        # Meera invites Kiran from home (creates room automatically)
        await meera.locator('#peopleHome li', has_text='Kiran').locator('button').click()
        await meera.wait_for_selector('#lobby:not(.hidden)')
        await kiran.wait_for_selector('#inviteModal:not(.hidden)'); print('kiran invite 2:', await kiran.text_content('#inviteSub'))
        await kiran.click('#acceptInvite'); await kiran.wait_for_selector('#lobby:not(.hidden)')
        print('meera room players:', await meera.locator('#lobbyPlayers .name').all_text_contents())
        # mid-game invite: arun starts, then invite a newcomer
        await arun.click('#startBtn'); await priya.wait_for_selector('#game:not(.hidden)')
        dev=await newpage(b); await dev.goto(BASE); await dev.fill('#nameInput','Dev'); await dev.click('#nameGo'); await dev.wait_for_timeout(600)
        await arun.click('#inviteTopBtn'); await arun.locator('#peopleList li', has_text='Dev').locator('button').click()
        await dev.wait_for_selector('#inviteModal:not(.hidden)'); print('dev invite:', await dev.text_content('#inviteSub'))
        await dev.click('#acceptInvite'); await dev.wait_for_selector('#game:not(.hidden)'); await dev.wait_for_timeout(300)
        print('dev watching:', await dev.is_visible('#watchNote'))
        print('errors', errs); await b.close()
asyncio.run(main())
