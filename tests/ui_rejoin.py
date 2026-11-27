# Coming back to a room: the same browser gets its own seat back instead of a second one ("Name 2"),
# in every game, and a different browser still gets a new seat. Needs the stand-in (bash prepare-mock.sh).
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name, ctx=None):
            ctx=ctx or await b.new_context(viewport={'width':390,'height':780})
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(BASE)
            if await pg.is_visible('#nameGo'): await pg.fill('#nameInput',name); await pg.click('#nameGo')
            await pg.wait_for_timeout(300); return pg
        names=lambda pg: pg.locator('#lobbyPlayers li').evaluate_all("els => els.map(e => e.innerText.replace(/\\s+/g,' ').trim())")
        for game in ['ondu','ludo','ruthless','poker','carrom']:
            tab=f'.game-tab[data-game="{game}"]'
            a=await page('Arun'); await a.click(tab); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
            v=await page('Vinay'); await v.click(tab); await v.wait_for_timeout(300); await v.click('#roomList li button'); await v.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(300)
            # 1. the phone loses its saved seat (as happened when leaving while disconnected), then comes back three times
            for _ in range(3):
                await v.evaluate("localStorage.removeItem('cardgame-session')"); await v.goto(BASE); await v.wait_for_timeout(400)
                await v.click(tab); await v.wait_for_timeout(300); await v.click('#roomList li button'); await v.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(300)
            got=await names(a)
            # 2. the shared link, opened fresh
            await v.evaluate("localStorage.removeItem('cardgame-session')"); await v.goto(BASE+'?room='+code); await v.wait_for_timeout(600)
            if await v.is_visible('#inviteJoin'): await v.click('#inviteJoin')
            await v.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(300)
            # 3. simply closing and reopening (saved seat intact)
            await v.goto('about:blank'); await v.goto(BASE); await v.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(300)
            after=await names(a)
            # 4. a different browser with the same name is a different person
            w=await page('Vinay'); await w.click(tab); await w.wait_for_timeout(300); await w.click('#roomList li button'); await w.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(300)
            other=await names(a)
            ok = len(got)==2 and len(after)==2 and len(other)==3 and any('Vinay 2' in n for n in other) and not any('Vinay 2' in n for n in after)
            print(f'{game}: after 3 returns {got} | link + reopen {after} | another phone {other} →', 'OK' if ok else 'PROBLEM')
            # 5. Leave still removes the seat
            await v.click('#leaveBtn'); await v.wait_for_selector('#home:not(.hidden)'); await a.wait_for_timeout(300)
            print(f'   leave removes the seat:', len(await names(a))==2)
            for q in (a,v,w): await q.context.close()
        print('errors', errs); await b.close()
asyncio.run(main())
