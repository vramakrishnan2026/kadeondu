# Ludo in a room: create from the Ludo tab, waiting-room settings, board, rolling, choosing a token,
# capture, reactions, chat, a watcher, finishing, playing again, and the turn timer.
# Needs the stand-in (bash prepare-mock.sh). Uses its /__test/die and /__test/ludo shortcuts.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name, w=390, h=844):
            pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page()
            pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(250); return pg
        async def status(pg): return ' '.join((await pg.inner_text('#ludoStatus')).split())
        async def settle(pg, ms=150):  # wait until the board has finished showing the last move
            await pg.wait_for_timeout(350)   # time for the answer to arrive
            await pg.wait_for_selector('#ludo:not(.busy)')
            await pg.wait_for_timeout(ms)
        async def where(pg, seat, i):  # which loop square / spot a token is drawn on, as board units
            return await pg.evaluate(f"() => {{ const t=document.querySelector('.ltok.ls{seat}[data-i=\"{i}\"]'); return [Math.round(parseFloat(t.style.left)*15)/100, Math.round(parseFloat(t.style.top)*15)/100] }}")

        a=await page('Arun'); k=await page('Kiran')
        # the Ludo tab is a real home now; a room made there is a Ludo room
        await a.click('.game-tab >> nth=1'); await a.wait_for_timeout(200)
        print('Ludo tab: brewing gone', not await a.is_visible('#brewing'), '| tagline:', await a.text_content('.home-card .tagline'))
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        print('waiting room:', await a.text_content('#lobbyGame'), '| Ludo rules shown', await a.is_visible('#ludoBlocks'), '| card settings hidden', not await a.is_visible('#stackingInput') and not await a.is_visible('#handSizeInput') and not await a.is_visible('#roundTimeInput'))
        print('classic by default [out on 1, capture bonus, home bonus, three 6s, blocks]:', [await a.is_checked('#'+x) for x in ['ludoReleaseOne','ludoCaptureBonus','ludoHomeBonus','ludoThreeSixes','ludoBlocks']], '| reactions off', not await a.is_checked('#reactionsInput'))
        print('start needs 2:', await a.text_content('#startBtn'), await a.is_disabled('#startBtn'))
        # the room is listed under Ludo, not under the card game
        await k.wait_for_timeout(400)
        print('card-game tab lists it:', await k.locator('#roomList li').count(), end=' | ')
        await k.click('.game-tab >> nth=1'); await k.wait_for_timeout(300); print('Ludo tab lists it:', await k.locator('#roomList li').count())
        await k.click('#roomList li button'); await k.wait_for_selector('#lobby:not(.hidden)')
        print('guest sees:', await k.text_content('#guestSettings'))
        await a.check('#reactionsInput'); await a.select_option('#turnTimeInput','0'); await a.wait_for_timeout(200)
        await a.screenshot(path='ludo1_waiting.png', full_page=True)
        hit(f'__test/die?room={code}&seq=6,6,5,1,5')
        await a.click('#startBtn'); await a.wait_for_selector('#ludo:not(.hidden)'); await k.wait_for_selector('#ludo:not(.hidden)'); await a.wait_for_timeout(400)
        print('board: tokens', await a.locator('.ltok').count(), '| plates', await a.locator('.lplate:not(.empty)').count(),
              '| my colour bottom left: Arun', await a.locator('#ludoBottom .lplate.me').count()==1 and 'me' in (await a.get_attribute('#ludoBottom .lplate >> nth=0','class')),
              'Kiran', 'me' in (await k.get_attribute('#ludoBottom .lplate >> nth=0','class')))
        print('Arun:', await status(a), '| roll on', await a.is_enabled('#ludoRoll'), '|| Kiran:', await status(k), '| roll on', await k.is_enabled('#ludoRoll'))
        await a.screenshot(path='ludo2_start.png')
        # 6: out of the yard by itself (all four are the same move), and roll again
        y0=await where(a,0,0)
        await a.click('#ludoRoll'); await settle(a)
        print('rolled 6:', await a.get_attribute('#ludoDie','data-v'), '| token out', (await where(a,0,0))!=y0, '|', await status(a), '| Kiran sees die', await k.get_attribute('#ludoDie','data-v'))
        # 6 again: a real choice now
        await a.click('#ludoRoll'); await settle(a)
        print('second 6:', await status(a), '| button:', await a.text_content('#ludoRoll'), '| tappable', await a.locator('.ltok.can').count(), '| Kiran tappable', await k.locator('.ltok.can').count())
        await a.screenshot(path='ludo3_choose.png')
        before=await where(a,0,0)
        box=await a.locator('.ltok.ls0[data-i="0"]').bounding_box()
        await a.mouse.click(box['x']+box['width']/2+14, box['y']+box['height']/2-12)   # a little off the token: the nearest one is picked
        await settle(a)
        print('moved 6 by a tap near it:', before, '->', await where(a,0,0))
        # 5: only one token can move, so it goes by itself; turn passes
        await a.click('#ludoRoll'); await settle(a); await settle(k)
        print('after a 5:', await status(a), '|| Kiran:', await status(k), '| roll on', await k.is_enabled('#ludoRoll'))
        # capture: Kiran one square in front of where Arun's next 5 lands
        hit(f'__test/ludo?room={code}&name=Arun&tokens=10,-1,-1,-1'); hit(f'__test/ludo?room={code}&name=Kiran&tokens=40,-1,-1,-1')   # Kiran (seat 2) at 40 = loop square 14
        await k.click('#ludoRoll'); await settle(k); await settle(a)   # 1: 40 -> 41 (loop square 15)
        ky=await where(a,2,0)
        await a.click('#ludoRoll'); await a.wait_for_timeout(1750)
        toast=await a.text_content('#toast'); await a.screenshot(path='ludo4_capture.png'); await settle(a)
        print('capture: toast', repr(toast), '| Kiran token moved back', (await where(a,2,0))!=ky, '|', await status(a), '(capture rolls again)')
        # reactions and the shared buttons row
        print('shared row is on the Ludo screen:', await a.evaluate("document.querySelector('.act-side').parentNode.id"), '| mic', await a.is_visible('#micBtn'), '| mute', await a.is_visible('#muteBtn'), '| reactions', await a.is_visible('#reactBtn'), '| info:', await a.text_content('#myInfo'))
        await a.click('#reactBtn'); await a.click('#reactTray .react-pick >> nth=1'); await k.wait_for_timeout(500)
        print('reaction seen by Kiran:', await k.locator('.react-float.main').count(), await k.text_content('.react-float.main .react-who') if await k.locator('.react-float.main').count() else '')
        # chat
        print('chat tab:', await a.is_visible('#chatTab'), end=' | ')
        await a.click('#chatTab'); await a.fill('#chatInput','good luck'); await a.press('#chatInput','Enter'); await a.click('#chatClose'); await k.wait_for_timeout(400)
        print('Kiran has a new-message dot:', await k.is_visible('#chatDot'))
        # a watcher mid-game
        w=await page('Priya'); await w.click('.game-tab >> nth=1'); await w.wait_for_timeout(300)
        print('room list says:', ' '.join((await w.inner_text('#roomList li')).split()))
        await w.click('#roomList li button'); await w.wait_for_selector('#ludo:not(.hidden)'); await w.wait_for_timeout(400)
        print('watcher:', await status(w), '| roll button hidden', not await w.is_visible('#ludoRoll'), '| tokens', await w.locator('.ltok').count(), '| Arun sees:', await a.text_content('#ludoWatchers'))
        await w.screenshot(path='ludo5_watching.png')
        # finish: Arun needs a 1
        hit(f'__test/ludo?room={code}&name=Arun&tokens=55,56,56,56'); hit(f'__test/die?room={code}&seq=1')
        await a.wait_for_timeout(300); print('plate shows 3 home:', await a.locator('#ludoBottom .lplate.me .lp-home i.in').count())
        await a.click('#ludoRoll'); await a.wait_for_selector('#endOverlay:not(.hidden)', timeout=8000)
        print('game over, Arun:', await a.text_content('#endTitle'), '|', await a.text_content('#endPoints'), '|', [' '.join(x.split()) for x in await a.locator('#scoreList li').all_inner_texts()], '| no toast over it', not await a.is_visible('#toast'), '| button:', await a.text_content('#nextRoundBtn'))
        await k.wait_for_selector('#endOverlay:not(.hidden)'); print('Kiran:', await k.text_content('#endTitle'), '| waits for host', await k.is_visible('#endWait'))
        await a.screenshot(path='ludo6_over.png')
        await a.click('#closeEnd'); await a.wait_for_timeout(200)
        print('closed: Scores button', await a.is_visible('#scoresBtn'), '| Play again', await a.is_visible('#ludoAgain'), '|', await status(a))
        # play again: the watcher gets a seat; the trophy shows
        await a.click('#ludoAgain'); await a.wait_for_timeout(700)
        print('next game: plates', await a.locator('.lplate:not(.empty)').count(), '| Priya seated', await w.locator('#ludoBottom .lplate.me').count()==1, '| Arun trophy:', await a.text_content('#ludoBottom .lplate.me .lp-wins'), '|', await status(a), '/', await status(k))
        await w.screenshot(path='ludo7_three.png')
        # fits the phone at several sizes, nothing scrolls
        for (wd,ht) in [(320,568),(360,600),(390,780),(412,860),(1280,720)]:
            await k.set_viewport_size({'width':wd,'height':ht}); await k.wait_for_timeout(250)
            m=await k.evaluate("() => { const b=document.getElementById('ludoBoard').getBoundingClientRect(), a=document.getElementById('ludoActions').getBoundingClientRect(), t=document.getElementById('ludoTop').getBoundingClientRect(); const tab=document.getElementById('chatTab').getBoundingClientRect(), roll=document.getElementById('ludoRoll').getBoundingClientRect(); return { scroll: document.documentElement.scrollHeight-innerHeight, side: Math.max(0, Math.round(Math.max(b.right, a.right)-innerWidth)), tabClear: tab.left >= roll.right && tab.top >= b.bottom, board: Math.round(b.width), square: Math.abs(b.width-b.height)<1, platesTop: Math.round(t.top), actionsBottom: Math.round(a.bottom), vh: innerHeight } }")
            print(f'{wd}x{ht}:', m, 'OK' if m['scroll']<=0 and m['side']<=0 and m['square'] and m['tabClear'] and m['actionsBottom']<=m['vh'] and m['platesTop']>=40 else 'PROBLEM')
            if (wd,ht)==(360,600): await k.screenshot(path='ludo8_small.png')
        # leaving mid-game: the game goes on for the other two
        await k.click('#leaveBtn'); await k.wait_for_selector('#home:not(.hidden)'); await a.wait_for_timeout(400)
        print('Kiran left: back on the Ludo tab', await k.get_attribute('.game-tab >> nth=1','aria-selected'), '| Arun sees plates', await a.locator('.lplate:not(.empty)').count(), '|', await status(a))
        # turn timer: nobody taps, the game rolls (and moves) for them, and the clock shows on the plate
        t1=await page('Tara'); t2=await page('Uma')
        await t1.click('.game-tab >> nth=1'); await t1.click('#createBtn'); await t1.wait_for_selector('#lobby:not(.hidden)'); c2=(await t1.text_content('#lobbyCode')).strip()
        await t2.goto(BASE+'?room='+c2); await t2.wait_for_timeout(600); await t2.click('#inviteJoin'); await t2.wait_for_selector('#lobby:not(.hidden)')
        print('joined by link straight into the Ludo room:', await t2.text_content('#lobbyGame'))
        await t1.select_option('#turnTimeInput','10'); await t1.wait_for_timeout(200)
        hit(f'__test/die?room={c2}&seq=3'); await t1.click('#startBtn'); await t1.wait_for_selector('#ludo:not(.hidden)'); await t1.wait_for_timeout(1200)
        print('clock:', await status(t1), '| bar on my plate', await t1.locator('#ludoBottom .lplate.me.timing').count())
        await t1.wait_for_timeout(10500); await settle(t1)
        print('after 10 s:', await status(t1), '| toast:', repr(await t1.text_content('#toast')), '| Uma:', await status(t2))
        # left-handed: both rows mirror
        await t2.evaluate("document.body.classList.add('lefty')"); await t2.wait_for_timeout(200)
        lay=await t2.evaluate("() => { const r=id=>document.getElementById(id).getBoundingClientRect(); return { dieRightOfRoll: r('ludoDie').left > r('ludoRoll').right - 2, micLeft: r('micBtn').left < r('muteBtn').left, tabLeft: r('chatTab').left < 5, rollH: Math.round(r('ludoRoll').height) } }")
        print('left-handed:', lay)
        await t2.screenshot(path='ludo9_lefty.png')
        # Ludo vs computer
        s1=await page('Solo'); await s1.click('.game-tab >> nth=1'); await s1.click('#soloBtn'); await s1.wait_for_timeout(200)
        await s1.select_option('#lsoloCount','2'); await s1.check('#lsoloReactions'); await s1.select_option('#lsoloTime','0'); await s1.click('#lsoloStart'); await s1.wait_for_selector('#ludo:not(.hidden)'); await s1.wait_for_timeout(500)
        print('solo: chip', await s1.text_content('#roomChip'), '| plates', await s1.locator('.lplate:not(.empty)').count(), '| no mic', not await s1.is_visible('#micBtn'), '| no chat tab', not await s1.is_visible('#chatTab'), '| reactions', await s1.is_visible('#reactBtn'))
        moved=0
        for n in range(14):
            await settle(s1, 100)
            if await s1.is_visible('#ludoRoll') and await s1.is_enabled('#ludoRoll'): await s1.click('#ludoRoll'); moved+=1
            elif await s1.locator('.ltok.can').count(): await s1.locator('.ltok.can').first.click(force=True); moved+=1
            else: await s1.wait_for_timeout(700)
        print('solo: my actions taken', moved, '| computer has played', await s1.evaluate("document.getElementById('ludoDie').className.includes('ls')"), '|', await status(s1))
        await s1.screenshot(path='ludo10_solo.png')
        await s1.click('#leaveBtn'); await s1.wait_for_selector('#home:not(.hidden)'); print('quit solo: home on the Ludo tab', await s1.get_attribute('.game-tab >> nth=1','aria-selected'))
        print('errors', errs); await b.close()
asyncio.run(main())
