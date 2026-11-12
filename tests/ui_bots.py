import asyncio, random
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
errs=[]
async def newpage(b):
    ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
async def human_turns(pg, others=[], limit=400):
    for _ in range(limit):
        if await pg.is_visible('#endOverlay'): return True
        if await pg.is_enabled('#callBtn') and await pg.is_visible('#callBtn'): await pg.click('#callBtn', force=True)
        for o in [pg]+others:
            if 'mine' in (await o.get_attribute('#status','class') or ''):
                cards=o.locator('#hand .card.playable')
                if await cards.count():
                    await cards.nth(random.randrange(await cards.count())).click(force=True)
                    if await o.is_visible('#colorPicker'): await o.click('#colorPicker [data-color=%s]'%random.choice('rygb'))
                elif await o.is_visible('#passBtn'): await o.click('#passBtn', force=True)
                elif await o.is_visible('#drawBtn'): await o.click('#drawBtn', force=True)
        await pg.wait_for_timeout(250)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # --- Solo
        me=await newpage(b); await me.goto(BASE); await me.fill('#nameInput','Vinay'); await me.click('#nameGo')
        await me.click('#soloBtn'); await me.select_option('#soloCount','3'); await me.screenshot(path='b_solo_setup.png')
        await me.click('#soloStart'); await me.wait_for_selector('#game:not(.hidden)')
        print('solo players:', [t.strip() for t in await me.locator('.opp .oname').all_text_contents()])
        await me.wait_for_timeout(2500); await me.screenshot(path='b_solo_game.png')
        ended=await human_turns(me); print('solo ended:', ended, await me.text_content('#endTitle'))
        await me.screenshot(path='b_solo_end.png')
        await me.click('#nextRoundBtn'); await me.wait_for_timeout(300); print('solo round2 hand:', await me.locator('#hand .card').count())
        await me.click('#leaveBtn'); await me.wait_for_selector('#home:not(.hidden)'); print('solo quit ok')
        # --- Room with bots
        host=await newpage(b); await host.goto(BASE); await host.fill('#nameInput','Arun'); await host.click('#nameGo'); await host.click('#createBtn'); await host.wait_for_selector('#lobby:not(.hidden)')
        await host.select_option('#botLevelInput','easy'); await host.wait_for_timeout(200)
        await host.click('#addBotBtn'); await host.click('#addBotBtn'); await host.wait_for_timeout(300)
        guest=await newpage(b); code=(await host.text_content('#lobbyCode')).strip()
        await guest.goto(BASE+'?room='+code); await guest.fill('#nameInput','Priya'); await guest.click('#nameGo'); await guest.wait_for_selector('#lobby:not(.hidden)')
        print('room players:', await host.locator('#lobbyPlayers .name').all_text_contents(), '| guest sees:', await guest.text_content('#guestSettings'))
        await host.screenshot(path='b_room_lobby.png')
        await host.click('#startBtn'); await guest.wait_for_selector('#game:not(.hidden)')
        ended=await human_turns(host,[guest],500); print('room ended:', ended, await guest.text_content('#endTitle'))
        print('log sample:', await guest.text_content('#logLine'))
        print('errors', errs); print(open('server.log').read()[-500:]); await b.close()
asyncio.run(main())
