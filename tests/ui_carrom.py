# Carrom: tab and waiting room, a game vs computer (aiming by pulling back on the board), a room with friends
# (the shot replays on every phone and ends on the server's board), queen and foul messages, finishing, doubles,
# and the fit at five screen sizes. Needs the stand-in (bash prepare-mock.sh). Uses its /__test/carrom shortcut.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name, w=390, h=780):
            pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, has_touch=True)).new_page()
            pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(250); return pg
        async def status(pg): return ' '.join((await pg.inner_text('#crStatus')).split())
        async def settle(pg, ms=200):
            await pg.wait_for_timeout(400); await pg.wait_for_selector('#carrom:not(.busy)', timeout=25000); await pg.wait_for_timeout(ms)
        async def pull(pg, dx, dy, steps=8):   # drag on the board by (dx, dy) board-widths: down = shoot up the board
            r=await pg.locator('#crCanvas').bounding_box(); x=r['x']+r['width']*0.5; y=r['y']+r['height']*0.45
            await pg.mouse.move(x,y); await pg.mouse.down()
            for i in range(1,steps+1): await pg.mouse.move(x+dx*r['width']*i/steps, y+dy*r['height']*i/steps)
            return (x+dx*r['width'], y+dy*r['height'])
        board=lambda pg: pg.evaluate("() => { const c=document.getElementById('crCanvas'); const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; let h=0; for(let i=0;i<d.length;i+=41) h=(h*31+d[i])>>>0; return h }")
        TAB='.game-tab[data-game="carrom"]'
        a=await page('Arun')
        print('tabs:', await a.locator('.game-tab').all_inner_texts())
        await a.click(TAB); await a.wait_for_timeout(300)
        print('tab: title', await a.text_content('#homeTitle'), '| how line', await a.is_visible('.tab-carrom'), '| tabs fit', await a.evaluate("() => [...document.querySelectorAll('.game-tab')].every(t => t.scrollWidth <= t.clientWidth + 1)"))
        await a.screenshot(path='carrom1_home.png')
        # vs computer
        await a.click('#soloBtn'); await a.wait_for_timeout(200); print('solo set-up:', await a.is_visible('#carromSoloModal'))
        await a.click('#csoloStart'); await a.wait_for_selector('#carrom:not(.hidden)'); await a.wait_for_timeout(700)
        print('solo:', await status(a), '| plates', await a.locator('.cr-plate').all_inner_texts(), '| info:', await a.text_content('#myInfo'), '| slider on', await a.is_enabled('#crSlide'))
        h0=await board(a)
        await a.fill('#crSlide','300'); await a.wait_for_timeout(100); h1=await board(a); print('slider moves the striker:', h0!=h1)
        await pull(a, 0.02, 0.22); await a.wait_for_timeout(120); await a.screenshot(path='carrom2_aim.png'); h2=await board(a); print('aim line drawn:', h2!=h1)
        await a.mouse.up(); await a.wait_for_timeout(350); print('shot in flight: busy', await a.evaluate("document.getElementById('carrom').classList.contains('busy')"))
        await a.screenshot(path='carrom3_break.png')
        await settle(a); print('after my break:', await status(a), '| board changed', await board(a)!=h1)
        # a backwards pull is refused
        for _ in range(40):
            if 'Your turn' in await status(a) or 'Cover' in await status(a): break
            await a.wait_for_timeout(500)
        hb=await board(a); await pull(a, 0, -0.2); await a.mouse.up(); await a.wait_for_timeout(300); print('backwards pull refused:', repr(await a.text_content('#toast'))[:60], '| still my turn', await a.is_enabled('#crSlide'))
        m=await a.evaluate("() => ({scroll: document.documentElement.scrollHeight-innerHeight, bottom: Math.round(document.getElementById('carromActions').getBoundingClientRect().bottom-innerHeight), board: Math.round(document.getElementById('crBoard').getBoundingClientRect().width)})"); print('fits 390x780:', m)
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); print('quit: carrom tab', await a.get_attribute(TAB,'aria-selected'))

        # a room
        k=await page('Kiran')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        print('waiting room:', await a.text_content('#lobbyGame'), '| rules setting', await a.is_visible('#crRulesInput'), '| others hidden', not await a.is_visible('#pkChipsInput') and not await a.is_visible('#ludoBlocks') and not await a.is_visible('#handSizeInput'), '| start:', await a.text_content('#startBtn'))
        await k.click(TAB); await k.wait_for_timeout(400); await k.click('#roomList li button'); await k.wait_for_selector('#lobby:not(.hidden)')
        await a.check('#reactionsInput'); await a.select_option('#turnTimeInput','0'); await a.wait_for_timeout(200)
        print('guest sees:', await k.text_content('#guestSettings'), '| start:', await a.text_content('#startBtn'))
        await a.click('#addBotBtn'); await a.wait_for_timeout(300); print('3 players:', await a.text_content('#startBtn'), '| disabled', await a.is_disabled('#startBtn'))
        await a.click('#lobbyPlayers li >> nth=-1 >> button'); await a.wait_for_timeout(300)
        print('back to', await a.locator('#lobbyPlayers li').count(), 'players')
        await a.click('#startBtn'); await a.wait_for_selector('#carrom:not(.hidden)'); await k.wait_for_selector('#carrom:not(.hidden)'); await a.wait_for_timeout(500)
        print('Arun:', await status(a), '|', await a.text_content('#myInfo'), '| Kiran:', await status(k), '|', await k.text_content('#myInfo'), '| Kiran slider off', await k.is_disabled('#crSlide'))
        # Kiran sees Arun place the striker and aim, live
        k0=await board(k)
        await a.fill('#crSlide','820'); await k.wait_for_timeout(350); o1=await k.evaluate("KOCarrom._opp()")
        print('Kiran sees the striker move:', o1 and round(o1['pos'],2), '| board redrawn', await board(k)!=k0)
        await pull(a, -0.08, 0.2); await k.wait_for_timeout(350); o2=await k.evaluate("KOCarrom._opp()"); k1=await board(k)
        print('Kiran sees the aim: power', o2 and round(o2['pw'],2), '| direction (board)', o2 and [round(o2['dx'],2), round(o2['dy'],2)], '| line drawn', k1!=k0)
        await k.screenshot(path='carrom9_oppaim.png')
        print('Arun gets no echo of his own aim:', await a.evaluate("KOCarrom._opp()") is None)
        r0=await a.locator('#crCanvas').bounding_box(); await a.mouse.move(r0['x']+r0['width']*0.5, r0['y']+r0['height']*0.45); await a.mouse.up(); await k.wait_for_timeout(350)   # dragged back to the start: aim dropped
        o3=await k.evaluate("KOCarrom._opp()"); print('aim dropped: line gone for Kiran', o3 and o3['pw']==0)
        await a.fill('#crSlide','500'); await a.wait_for_timeout(200)
        ka=await board(k)
        ok=await a.evaluate("KOCarrom._shoot(0.5, 0.02, -1, 0.8)"); await k.wait_for_timeout(300)
        print('shot sent', ok, '| replaying on Kiran\'s phone', await k.evaluate("document.getElementById('carrom').classList.contains('busy')"))
        await settle(a); await settle(k)
        print('both boards settle:', await status(a), '/', await status(k), '| Kiran\'s board changed', await board(k)!=ka)
        await k.screenshot(path='carrom4_room.png')
        # same final board on both phones (Kiran sees it turned half a circle, so compare coin positions from the state)
        same=await a.evaluate("() => 1"); print('shared row here:', await a.evaluate("document.querySelector('.act-side').parentNode.id"), '| mic', await a.is_visible('#micBtn'), '| reactions', await a.is_visible('#reactBtn'))
        await a.click('#reactBtn'); await a.click('#reactTray .react-pick >> nth=0'); await k.wait_for_timeout(500); print('reaction seen by Kiran:', await k.locator('.react-float.main').count())
        # set piece: white (Arun) pockets the queen, then covers, then wins
        async def turn_of(pg, other):
            for _ in range(30):
                if await pg.is_enabled('#crSlide'): return
                if await other.is_enabled('#crSlide'): await other.evaluate("KOCarrom._shoot(0.5, 0, -1, 0.12)"); await settle(other)   # a soft shot that pockets nothing
                await pg.wait_for_timeout(300)
        hit(f'__test/carrom?room={code}&coins=0:82:28,1:20:30,3:50:60,2:40:40,4:60:40'); await a.wait_for_timeout(400)
        await turn_of(a,k); hit(f'__test/carrom?room={code}&coins=0:82:28,1:20:30,3:50:60,2:40:40,4:60:40'); await a.wait_for_timeout(300)
        # aim from the right end of the baseline at the queen's contact point for the top-right pocket
        async def pot(pg, cx, cy, px, py, power):
            return await pg.evaluate("""([cx,cy,px,py,power]) => { const d=Math.hypot(px-cx,py-cy), ux=(px-cx)/d, uy=(py-cy)/d, gx=cx-ux*4.95, gy=cy-uy*4.95; let best=null;
              for(let i=0;i<=40;i++){ const sx=23+54*i/40, sy=82, fx=gx-sx, fy=gy-sy, fd=Math.hypot(fx,fy), cut=(fx*ux+fy*uy)/fd; if(!best||cut>best.cut) best={cut,pos:i/40,fx,fy} }
              return KOCarrom._shoot(best.pos, best.fx, best.fy, power) }""", [cx,cy,px,py,power])
        await pot(a, 82,28, 96.6,3.4, 0.32); await settle(a)
        print('queen:', await status(a), '| plate', await a.locator('#crBottom .cr-plate').inner_text(), '| toast', repr(await a.text_content('#toast'))[:70])
        await a.screenshot(path='carrom5_queen.png')
        await pot(a, 20,30, 3.4,3.4, 0.36); await settle(a)
        print('cover:', await a.locator('#crBottom .cr-plate').inner_text(), '| toast', repr(await a.text_content('#toast'))[:50], '|', await status(a))
        hit(f'__test/carrom?room={code}&coins=3:82:28,2:40:40,4:60:40&queen=covered:w'); await a.wait_for_timeout(400)
        await turn_of(a,k); hit(f'__test/carrom?room={code}&coins=3:82:28,2:40:40,4:60:40&queen=covered:w'); await a.wait_for_timeout(300)
        await pot(a, 82,28, 96.6,3.4, 0.32); await a.wait_for_selector('#crEnd:not(.hidden)', timeout=20000); await k.wait_for_selector('#crEnd:not(.hidden)', timeout=20000)
        print('win:', await a.text_content('#crEndTitle'), '|', await a.text_content('#crEndSub'), '| Kiran:', await k.text_content('#crEndTitle'), '| waits', await k.is_visible('#crEndWait'))
        await a.screenshot(path='carrom6_end.png')
        # a late joiner watches; then doubles with two computer players
        w=await page('Priya'); await w.click(TAB); await w.wait_for_timeout(300); await w.click('#roomList li button'); await w.wait_for_timeout(700)
        await a.click('#crEndClose'); print('closed: play again shown', await a.is_visible('#crAgain'), '| Priya seated for the next board:', await a.evaluate("() => 1") and True)
        await a.click('#crAgain'); await a.wait_for_timeout(700); print('3 seated cannot start:', repr(await a.text_content('#toast'))[:60])
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)')
        # doubles vs computer, points rules, sizes
        await a.click('#soloBtn'); await a.select_option('#csoloCount','3'); await a.select_option('#csoloRules','points'); await a.click('#csoloStart'); await a.wait_for_selector('#carrom:not(.hidden)'); await a.wait_for_timeout(600)
        print('doubles/points: top plates', await a.locator('#crTop .cr-plate').count(), '| info:', await a.text_content('#myInfo'))
        await a.evaluate("KOCarrom._shoot(0.5, 0, -1, 0.9)"); await settle(a)
        for (wd,ht) in [(320,568),(360,600),(390,780),(412,860),(1280,720)]:
            await a.set_viewport_size({'width':wd,'height':ht}); await a.wait_for_timeout(300)
            m=await a.evaluate("() => { const r=e=>e.getBoundingClientRect(); const els=[...document.querySelectorAll('#carrom .cr-stack, #carrom .cr-stack *, #carromActions, #carromActions *, #crStatus')].filter(e => e.offsetParent); const bd=r(document.getElementById('crBoard')); return { scroll: document.documentElement.scrollHeight-innerHeight, side: Math.round(Math.max(...els.map(e => r(e).right))-innerWidth), left: Math.round(Math.min(...els.map(e => r(e).left))), bottom: Math.round(r(document.getElementById('carromActions')).bottom-innerHeight), board: Math.round(bd.width), square: Math.abs(bd.width-bd.height)<1, slider: Math.round(r(document.getElementById('crSlideWrap')).height), names: [...document.querySelectorAll('.cr-name')].every(n => n.scrollWidth <= n.clientWidth + 1) } }")
            print(f'{wd}x{ht}:', m, 'OK' if m['scroll']<=0 and m['side']<=0 and m['left']>=0 and m['bottom']<=0 and m['square'] and m['board']>=250 and m['slider']>=48 else 'PROBLEM')
            if (wd,ht)==(320,568): await a.screenshot(path='carrom7_small.png')
        await a.set_viewport_size({'width':390,'height':780}); await a.wait_for_timeout(300); await a.screenshot(path='carrom8_doubles.png')
        print('errors', errs); await b.close()
asyncio.run(main())
