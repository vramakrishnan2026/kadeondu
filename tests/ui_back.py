# The phone's Back button: closes pop-ups and chat, returns from lessons, asks before leaving a room, and only
# closes the app from the plain home screen. Needs the stand-in (bash prepare-mock.sh).
import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]; ask={'answer':True,'seen':[]}
        ctx=await b.new_context(viewport={'width':390,'height':780}); a=await ctx.new_page()
        a.on('pageerror', lambda e: errs.append(str(e)))
        async def dlg(d):
            ask['seen'].append(d.message)
            await (d.accept() if ask['answer'] else d.dismiss())
        a.on('dialog', lambda d: asyncio.ensure_future(dlg(d)))
        await a.goto('about:blank'); await a.goto(BASE); await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.wait_for_timeout(400)
        async def back():
            try: await a.evaluate('history.back()')
            except Exception: pass   # (leaving the app ends the page)
            await a.wait_for_timeout(450)
        vis=lambda sel: a.is_visible(sel)
        async def here(): return 'app' if a.url.startswith(BASE) else 'left the app'
        # pop-up on the home screen
        await a.click('#soloBtn'); await a.wait_for_timeout(300); await back()
        print('home pop-up: closed', not await vis('#soloModal'), '| still in', await here())
        # closing by its own button leaves no stray step: one Back from home leaves the app
        await a.click('#soloBtn'); await a.wait_for_timeout(300); await a.click('#soloCancel'); await a.wait_for_timeout(400)
        await back(); print('home, nothing open: Back', await here())
        await a.go_forward(); await a.wait_for_timeout(600)
        if not await vis('#home'): await a.goto(BASE); await a.wait_for_timeout(500)
        # brewing tab
        await a.click('.game-tab[data-game="ruthless"]'); await a.wait_for_timeout(300); await back()
        print('brewing tab: back to first game', await a.get_attribute('.game-tab >> nth=0','aria-selected'), '|', await here())
        # lesson
        await a.click('.game-tab[data-game="poker"]'); await a.wait_for_timeout(300); await a.click('#pkLessons li button'); await a.wait_for_selector('#school:not(.hidden)'); await a.wait_for_timeout(200)
        await back(); print('lesson: back to Poker School home', await vis('#home') and await vis('#pkHome'), '|', await here())
        # a game vs computer: pop-up first, then ask, stay on "no"
        await a.click('.game-tab[data-game="ludo"]'); await a.wait_for_timeout(200); await a.click('#soloBtn'); await a.click('#lsoloStart'); await a.wait_for_selector('#ludo:not(.hidden)'); await a.wait_for_timeout(500)
        ask['answer']=False; ask['seen'].clear(); await back()
        print('in a game, answer no: asked', ask['seen'], '| still playing', await vis('#ludo'))
        await back(); print('asked again on the next Back', len(ask['seen'])==2, '| still playing', await vis('#ludo'))
        ask['answer']=True; await back(); print('answer yes: home', await vis('#home'), '|', await here())
        # a room: chat, then waiting room
        await a.click('.game-tab[data-game="ondu"]'); await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); await a.wait_for_timeout(400)
        await a.click('#chatTab'); await a.wait_for_timeout(300); await back(); print('chat: closed', await a.get_attribute('#chat','aria-hidden')=='true', '| still in waiting room', await vis('#lobby'))
        ask['answer']=False; ask['seen'].clear(); await back(); print('waiting room, no: asked', len(ask['seen'])==1, '| stays', await vis('#lobby'))
        ask['answer']=True; await back(); await a.wait_for_timeout(500); print('waiting room, yes: home', await vis('#home'))
        await back(); print('then Back from home', await here())
        print('errors', errs); await b.close()
asyncio.run(main())
