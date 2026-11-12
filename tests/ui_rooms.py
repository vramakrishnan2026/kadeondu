import asyncio, random
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def newpage(b, w=390, h=780):
    ctx=await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2); pg=await ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept())); return pg
errs=[]
async def play_until_end(pages):
    for _ in range(800):
        for pg in pages:
            if await pg.is_visible('#endOverlay'): return True
        for pg in pages:
            if await pg.is_enabled('#callBtn') and await pg.is_visible('#callBtn'): await pg.click('#callBtn', force=True)
        for pg in pages:
            if 'mine' not in (await pg.get_attribute('#status','class') or ''): continue
            cards=pg.locator('#hand .card.playable')
            if await cards.count():
                await cards.nth(random.randrange(await cards.count())).click(force=True)
                if await pg.is_visible('#colorPicker'): await pg.click('#colorPicker [data-color=%s]'%random.choice('rygb'))
            elif await pg.is_visible('#passBtn'): await pg.click('#passBtn', force=True)
            else: await pg.click('#drawBtn', force=True)
            break
        await pages[0].wait_for_timeout(60)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        kiran=await newpage(b); await kiran.goto(BASE); await kiran.fill('#nameInput','Kiran'); await kiran.click('#nameGo'); await kiran.wait_for_timeout(400)
        print('empty list msg visible:', await kiran.is_visible('#noRooms'))
        arun=await newpage(b); await arun.goto(BASE); await arun.fill('#nameInput','Arun'); await arun.click('#nameGo'); await arun.click('#createBtn'); await arun.wait_for_selector('#lobby:not(.hidden)')
        await kiran.wait_for_selector('#roomList li'); print('kiran sees:', (await kiran.text_content('#roomList li')).strip())
        priya=await newpage(b); await priya.goto(BASE); await priya.fill('#nameInput','Priya'); await priya.click('#nameGo')
        await priya.wait_for_selector('#roomList li button'); await priya.click('#roomList li button'); await priya.wait_for_selector('#lobby:not(.hidden)')
        await kiran.wait_for_timeout(300); print('kiran sees:', (await kiran.text_content('#roomList li')).strip())
        await kiran.screenshot(path='r_home_list.png')
        await arun.click('#startBtn'); await priya.wait_for_selector('#game:not(.hidden)')
        await kiran.wait_for_timeout(400); print('kiran sees:', (await kiran.text_content('#roomList li')).strip())
        await kiran.click('#roomList li button'); await kiran.wait_for_selector('#game:not(.hidden)'); await kiran.wait_for_timeout(300)
        print('kiran watching note:', await kiran.is_visible('#watchNote'), 'hand cards:', await kiran.locator('#hand .card').count(), 'status:', await kiran.text_content('#status'))
        print('arun sees watchers:', await arun.text_content('#watchers'))
        await kiran.screenshot(path='r_watching.png')
        ended=await play_until_end([arun,priya]); await kiran.wait_for_timeout(400)
        print('ended', ended, 'kiran scoreboard:', (await kiran.text_content('#scoreList')).replace('\n',' '))
        await arun.click('#nextRoundBtn'); await kiran.wait_for_timeout(500)
        print('round2 kiran cards:', await kiran.locator('#hand .card').count(), 'watchNote', await kiran.is_visible('#watchNote'))
        # leave all -> list empties
        for pg in [arun,priya,kiran]: await pg.click('#leaveBtn'); await pg.wait_for_timeout(200)
        await kiran.wait_for_timeout(500); print('after all left, kiran list items:', await kiran.locator('#roomList li').count())
        print('errors', errs); await b.close()
asyncio.run(main())
