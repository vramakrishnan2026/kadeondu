# Ondu Ruthless: its tab and card guide, a room (must-play rule, stacking, draw until a card fits, seven swap with a
# chosen player, 25 cards = out), a game vs computer, and that the standard game is untouched.
# Needs the stand-in (bash prepare-mock.sh). Uses its /__test/hand shortcut.
import asyncio, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name, w=390, h=780):
            pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page()
            pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(250); return pg
        async def status(pg): return ' '.join((await pg.inner_text('#status')).split())
        async def hand(pg): return await pg.locator('#hand .card').evaluate_all("els => els.map(e => e.getAttribute('aria-label'))")
        async def playcard(pg, label): await pg.click(f'#hand .card[aria-label="{label}"] >> nth=0')
        TAB='.game-tab[data-game="ruthless"]'
        a=await page('Arun')
        print('tab: no longer "soon"', not await a.locator(TAB+' .soon').count(), '| all tabs fit', await a.evaluate("() => [...document.querySelectorAll('.game-tab')].every(t => t.scrollWidth <= t.clientWidth + 1)"))
        await a.click(TAB); await a.wait_for_timeout(300)
        print('home:', await a.text_content('#homeTitle'), '| brewing gone', not await a.is_visible('#brewing'), '| menu', await a.is_visible('#createBtn'), '| ruthless note', await a.is_visible('#menu .ruthless-note'))
        await a.click('#menu .ruthless-rules-btn'); await a.wait_for_timeout(200)
        print('card guide:', await a.locator('#ruthlessCards li').count(), 'cards |', await a.locator('#ruthlessCards .card').evaluate_all("els => els.map(e => e.getAttribute('aria-label'))"))
        await a.screenshot(path='ruthless1_guide.png'); await a.click('#ruthlessRulesClose'); await a.screenshot(path='ruthless0_home.png')
        k=await page('Kiran'); r=await page('Ravi')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        print('waiting room:', await a.text_content('#lobbyGame'), '| rules note', await a.is_visible('#lobby .ruthless-note'), '| stacking switch hidden', not await a.is_visible('#stackingInput'), '| hand size kept', await a.is_visible('#handSizeInput'))
        await k.wait_for_timeout(400); print('standard tab does not list it:', await k.locator('#roomList li').count()==0, end=' | ')
        for q in (k,r): await q.click(TAB); await q.wait_for_timeout(300); await q.click('#roomList li button'); await q.wait_for_selector('#lobby:not(.hidden)')
        print('ruthless tab does')
        await a.select_option('#turnTimeInput','0'); await a.select_option('#roundTimeInput','0'); await a.wait_for_timeout(200)
        await a.click('#startBtn'); await a.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(600)
        print('started:', await a.text_content('#myInfo'), '| deck', await a.text_content('#deckCount'))
        # must play if you can; no pass button
        hit(f'__test/hand?room={code}&name=Kiran&cards=g:1,g:2,b:d4'); hit(f'__test/hand?room={code}&name=Ravi&cards=y:1,y:2,y:3')
        hit(f'__test/hand?room={code}&name=Arun&cards=r:d2,r:7,b:9,g:skipall,w:wd10&top=r:5&turn=1'); await a.wait_for_timeout(400)
        print('Arun:', await status(a), '| draw disabled', await a.is_disabled('#drawBtn'), '| hand', await hand(a))
        await a.screenshot(path='ruthless2_hand.png')
        # stacking: +2, Kiran answers +4, Ravi picks up 6
        await playcard(a,'red Draw 2'); await k.wait_for_timeout(500)
        print('Kiran:', await status(k), '| playable', await k.locator('#hand .card.playable').count())
        await playcard(k,'blue Draw 4'); await r.wait_for_timeout(500); print('Ravi:', await status(r), '| button', ' '.join((await r.inner_text('#drawBtn')).split()))
        await r.click('#drawBtn'); await a.wait_for_timeout(500); print('Ravi picked up:', await r.text_content('#myInfo'), '| Arun:', await status(a))
        # seven: choose who to swap with
        hit(f'__test/hand?room={code}&name=Arun&cards=b:7,b:9,g:1,g:2&top=b:5&turn=1'); await a.wait_for_timeout(400)
        await playcard(a,'blue 7'); await a.wait_for_timeout(250)
        print('seven: picker', await a.is_visible('#swapPicker'), '|', await a.locator('.swap-pick').all_inner_texts(), '|', await a.text_content('#swapMine'))
        await a.screenshot(path='ruthless3_swap.png')
        await a.click('.swap-pick >> nth=0'); await a.wait_for_timeout(600)
        print('swapped: Arun now', await a.text_content('#myInfo'), '| Kiran now', await k.text_content('#myInfo'), '| toast:', repr(await k.text_content('#toast')))
        # draw until a card fits, then it must be played
        hit(f'__test/hand?room={code}&name=Ravi&cards=w:roul&top=r:3'); hit(f'__test/hand?room={code}&name=Kiran&cards=g:1&turn=1'); await k.wait_for_timeout(400)
        st=await status(k); await k.click('#drawBtn'); await k.wait_for_timeout(500)
        print('no match:', st, '→', await k.text_content('#myInfo'), '|', await status(k), '| pass hidden', not await k.is_visible('#passBtn'), '| one playable', await k.locator('#hand .card.playable').count())
        # 25 cards: out
        hit(f'__test/hand?room={code}&name=Kiran&cards=g:1&count=20'); hit(f'__test/hand?room={code}&name=Ravi&cards=y:1,y:2&top=g:5')
        hit(f'__test/hand?room={code}&name=Arun&cards=w:wd10,g:3,g:4&turn=1'); await a.wait_for_timeout(400)
        order=await a.evaluate("1")
        await playcard(a,'Wild +10'); await a.click('#colorPicker [data-color="g"]'); await a.wait_for_timeout(500)
        who = k if 'pick up 10' in await status(k) else r
        victim='Kiran' if who is k else 'Ravi'
        if who is r: hit(f'__test/hand?room={code}&name=Ravi&cards=y:1&count=20'); await r.wait_for_timeout(300)
        await who.click('#drawBtn'); await a.wait_for_timeout(700)
        print(victim, 'picked up 10 with 20 in hand:', await status(who), '| toast for Arun:', repr(await a.text_content('#toast')), '| players left at Arun\'s table', 1+await a.locator('#seats .seat').count())
        await who.screenshot(path='ruthless4_out.png')
        print('out player: no buttons', not await who.is_visible('#drawBtn'), '| hand empty', await who.locator('#hand .card').count()==0)
        # fits the phone
        for (wd,ht) in [(320,568),(390,780),(412,860)]:
            await a.set_viewport_size({'width':wd,'height':ht}); await a.wait_for_timeout(300)
            m=await a.evaluate("() => ({scroll: document.documentElement.scrollHeight-innerHeight, bottom: Math.round(document.getElementById('gameActions').getBoundingClientRect().bottom-innerHeight)})")
            print(f'{wd}x{ht}:', m, 'OK' if m['scroll']<=0 and m['bottom']<=0 else 'PROBLEM')
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); print('leave: back on the ruthless tab', await a.get_attribute(TAB,'aria-selected'))
        # vs computer
        await a.click('#soloBtn'); await a.wait_for_timeout(200); print('set-up: stacking option hidden', not await a.is_visible('#soloStacking'))
        await a.select_option('#soloCount','4'); await a.click('#soloStart'); await a.wait_for_selector('#game:not(.hidden)'); await a.wait_for_timeout(500)
        moves=0
        for step in range(400):
            await a.wait_for_timeout(120)
            if await a.is_visible('#endOverlay'): break
            if await a.is_visible('#colorPicker'): await a.click('#colorPicker [data-color="r"]'); continue
            if await a.is_visible('#swapPicker'): await a.click('.swap-pick >> nth=0'); continue
            if await a.locator('#hand .card.playable').count(): await a.locator('#hand .card.playable').first.click(); moves+=1
            elif await a.is_visible('#drawBtn') and await a.is_enabled('#drawBtn'): await a.click('#drawBtn'); moves+=1
        print('vs computer: my moves', moves, '| round ended', await a.is_visible('#endOverlay'), '|', (await a.text_content('#endTitle')) if await a.is_visible('#endOverlay') else await status(a))
        await a.screenshot(path='ruthless5_solo.png')
        # the standard game still has its own rules
        s=await page('Sita'); await s.click('#soloBtn'); print('standard set-up keeps stacking option', await s.is_visible('#soloStacking')); await s.click('#soloStart'); await s.wait_for_selector('#game:not(.hidden)'); await s.wait_for_timeout(500)
        print('standard game:', await s.text_content('#myInfo'), '| deck', await s.text_content('#deckCount'))
        # the only real player is knocked out with computer players still in: the round ends at once
        await s.click('#leaveBtn'); await s.wait_for_selector('#home:not(.hidden)'); await s.click(TAB); await s.click('#createBtn'); await s.wait_for_selector('#lobby:not(.hidden)'); c2=(await s.text_content('#lobbyCode')).strip()
        for _ in range(3): await s.click('#addBotBtn'); await s.wait_for_timeout(200)
        await s.select_option('#turnTimeInput','0'); await s.click('#startBtn'); await s.wait_for_selector('#game:not(.hidden)'); await s.wait_for_timeout(400)
        hit(f'__test/hand?room={c2}&name=Sita&cards=y:1&count=24&top=b:9&turn=1'); await s.wait_for_timeout(400)
        await s.click('#drawBtn'); await s.wait_for_selector('#endOverlay:not(.hidden)', timeout=8000)
        print('out with 3 computers left: round over straight away |', await s.text_content('#endTitle'), '|', (await s.text_content('#endPoints'))[:95], '| next round button', await s.is_visible('#nextRoundBtn'))
        await s.screenshot(path='ruthless6_botsonly.png')
        await s.click('#nextRoundBtn'); await s.wait_for_timeout(700); print('next round: dealt back in', await s.text_content('#myInfo'))
        print('errors', errs); await b.close()
asyncio.run(main())
