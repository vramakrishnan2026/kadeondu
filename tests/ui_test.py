import asyncio, random, sys
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        try: b = await p.chromium.launch()
        except Exception: b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        names=['Arun','Priya','Kiran','Meera']
        pages=[]; errors=[]
        for i,n in enumerate(names):
            ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2)
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            pages.append(pg)
        h=pages[0]
        await h.goto(BASE); await h.screenshot(path='shot_home.png')
        await h.fill('#nameInput','Arun'); await h.click('#nameGo'); await h.click('#createBtn')
        await h.wait_for_selector('#lobby:not(.hidden)')
        code=(await h.text_content('#lobbyCode')).strip(); print('room',code)
        for pg,n in zip(pages[1:],names[1:]):
            await pg.goto(BASE+'?room='+code); await pg.fill('#nameInput',n); await pg.click('#nameGo')
            await pg.wait_for_selector('#lobby:not(.hidden)')
        await h.wait_for_timeout(300); await h.screenshot(path='shot_lobby.png')
        await h.check('#stackingInput'); await h.wait_for_timeout(200)
        await h.click('#startBtn')
        for pg in pages: await pg.wait_for_selector('#game:not(.hidden)')
        await h.wait_for_timeout(300); await h.screenshot(path='shot_game.png')
        # reconnect test: reload Priya
        await pages[1].reload(); await pages[1].wait_for_selector('#game:not(.hidden)'); print('reload rejoin ok')
        turns=0; shot_wild=False
        while turns<600:
            turns+=1
            ended=False
            for pg in pages:
                if await pg.is_visible('#endOverlay'): ended=True
            if ended: break
            acted=False
            for pg in pages:
                if await pg.is_enabled('#callBtn'):
                    await pg.click('#callBtn', force=True); await pg.wait_for_timeout(60)
                catch=pg.locator('.catch')
                if await catch.count() and random.random()<0.5:
                    try: await catch.first.click(timeout=300, force=True)
                    except Exception: pass
            for pg in pages:
                if 'mine' not in (await pg.get_attribute('#status','class') or ''): continue
                cards=pg.locator('#hand .card.playable')
                if await cards.count():
                    c=cards.nth(random.randrange(await cards.count()))
                    await c.click()
                    if await pg.is_visible('#colorPicker'):
                        if not shot_wild: await pg.screenshot(path='shot_wild.png'); shot_wild=True
                        await pg.click('#colorPicker [data-color=%s]'%random.choice('rygb'))
                elif await pg.is_visible('#passBtn'): await pg.click('#passBtn')
                else: await pg.click('#drawBtn', force=True)
                acted=True; break
            await pages[0].wait_for_timeout(80)
            if turns==8: await pages[0].screenshot(path='shot_mid.png')
        print('turns',turns)
        await pages[0].wait_for_timeout(400)
        await pages[0].screenshot(path='shot_end.png')
        print('end visible', await pages[0].is_visible('#endOverlay'), await pages[0].text_content('#endTitle'))
        # next round
        await h.click('#nextRoundBtn'); await pages[2].wait_for_timeout(400)
        print('round2 game visible', await pages[2].is_visible('#game'), 'overlay hidden', not await pages[2].is_visible('#endOverlay'))
        # late joiner mid-round
        ctx=await b.new_context(viewport={'width':1280,'height':800}); late=await ctx.new_page(); late.on('dialog', lambda d: asyncio.ensure_future(d.accept())); late.on('pageerror', lambda e: errors.append(str(e)))
        await late.goto(BASE+'?room='+code); await late.fill('#nameInput','Late'); await late.click('#nameGo')
        await late.wait_for_selector('#game:not(.hidden)'); await late.wait_for_timeout(300)
        print('late hand', await late.locator('#hand .card').count())
        await late.screenshot(path='shot_desktop.png')
        # leave
        await late.click('#leaveBtn'); await late.wait_for_selector('#home:not(.hidden)'); print('leave ok')
        # bad code
        await late.click('.code-box summary'); await late.fill('#codeInput','ZZZZ'); await late.click('#joinBtn'); await late.wait_for_timeout(500)
        print('bad code toast:', await late.text_content('#toast'), 'home', await late.is_visible('#home'))
        print('page errors', errors)
        await b.close()
asyncio.run(main())
