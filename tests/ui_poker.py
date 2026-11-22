# Poker School: home tab and levels, a lesson with its quiz, the drills, a table against the computer with the coach,
# and a table with friends (hidden cards, betting, showdown, watcher, end of game). Fits the phone with no scrolling.
# Needs the stand-in (bash prepare-mock.sh). Uses its /__test/deck shortcut.
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
        async def status(pg): return ' '.join((await pg.inner_text('#pkStatus')).split())
        TAB='.game-tab[data-game="poker"]'
        a=await page('Arun')
        await a.click(TAB); await a.wait_for_timeout(400)
        print('tab: title', await a.text_content('#homeTitle'), '| levels', await a.locator('.pk-level').count(), '| lessons', await a.locator('#pkLessons li').count(), '| drills', await a.locator('#pkDrills .tile').count(), '| tiles:', await a.text_content('#createBtn .t-title'), '/', await a.text_content('#soloBtn .t-sub'))
        print('four tabs fit:', await a.evaluate("() => [...document.querySelectorAll('.game-tab')].map(t => t.querySelector('span').scrollWidth <= t.querySelector('span').clientWidth + 1)"))
        await a.screenshot(path='poker1_home.png', full_page=True)
        await a.click('.pk-level[data-level="advanced"]'); await a.wait_for_timeout(150)
        print('advanced: first lesson', await a.text_content('#pkLessons li .rname'), '| drills', await a.locator('#pkDrills .tile').count())
        await a.reload(); await a.wait_for_timeout(400); await a.click(TAB); await a.wait_for_timeout(300)
        print('level remembered:', await a.get_attribute('.pk-level.on','data-level'))
        await a.click('.pk-level[data-level="beginner"]')
        # a lesson, then its quiz (answers read from the lesson data)
        await a.click('#pkLessons li >> nth=1 >> button'); await a.wait_for_selector('#school:not(.hidden)')
        print('lesson:', await a.text_content('#scTitle'), '|', await a.text_content('#scStep'), '| cards shown', await a.locator('#scBody .pc').count())
        await a.screenshot(path='poker2_lesson.png')
        n=await a.evaluate("POKER_LEARN.lessons.beginner[1].pages.length")
        for _ in range(n): await a.click('#scFoot .primary')
        print('quiz:', await a.text_content('#scStep'), '|', await a.text_content('.sc-h'))
        ans=await a.evaluate("POKER_LEARN.lessons.beginner[1].quiz.map(q => q.answer)")
        for i,k in enumerate(ans):
            await a.click(f'.sc-opt >> nth={k if i else (k+1)%2}')   # first one wrong on purpose
            if i==1: await a.screenshot(path='poker3_quiz.png')
            if i==0: print('wrong answer shows why:', (await a.text_content('.sc-why'))[:60], '| right one marked', await a.locator('.sc-opt.right').count())
            await a.click('#scFoot .primary')
        print('score:', await a.text_content('.sc-h'), '| buttons:', await a.locator('#scFoot button').all_inner_texts())
        await a.click('#scFoot .ghost'); await a.wait_for_selector('#home:not(.hidden)')
        print('back home: lesson marked', await a.text_content('#pkLessons li >> nth=1 >> .rmeta'))
        # every drill produces sound questions
        for lv in ['beginner','intermediate','advanced']:
            await a.click(f'.pk-level[data-level="{lv}"]'); await a.wait_for_timeout(100)
            for d in range(await a.locator('#pkDrills .tile').count()):
                title=await a.text_content(f'#pkDrills .tile >> nth={d} >> .t-title')
                await a.click(f'#pkDrills .tile >> nth={d}'); await a.wait_for_selector('#school:not(.hidden)'); await a.wait_for_timeout(250)
                good=0
                for q in range(10):
                    opts=await a.locator('.sc-opt').count()
                    if q==0 and lv!='beginner': await a.screenshot(path=f'poker4_drill_{lv}_{d}.png')
                    await a.click(f'.sc-opt >> nth={q%opts}'); good+=await a.locator('.sc-opt.right').count()==1
                    await a.click('#scFoot .primary')
                print(f'drill {lv}/{title}: 10 questions, each with one right answer', good==10, '|', await a.text_content('.sc-h'))
                await a.click('#scFoot .ghost'); await a.wait_for_selector('#home:not(.hidden)')
        await a.click('.pk-level[data-level="beginner"]')
        # vs computer, coach on
        await a.click('#soloBtn'); await a.wait_for_timeout(200)
        print('solo set-up shown:', await a.is_visible('#pokerSoloModal'))
        await a.select_option('#psoloCount','5'); await a.click('#psoloStart'); await a.wait_for_selector('#poker:not(.hidden)'); await a.wait_for_timeout(600)
        print('solo table: chip', await a.text_content('#roomChip'), '| seats', await a.locator('.pk-seat').count(), '| my cards', await a.locator('#pkMe .pc.big:not(.slot)').count(), '| others hidden', await a.locator('.pk-seat .pc.back').count(), '| no mic', not await a.is_visible('#micBtn'))
        acted=0; reviewed=False; shots=0
        for step in range(140):
            await a.wait_for_timeout(350)
            if await a.is_visible('#pkCoach') and await a.get_attribute('#pkCoach','data-mode')=='advice' and shots==0:
                print('coach (beginner shows it):', await a.text_content('#pkCoach'))
                await a.click('#pkCoach'); await a.wait_for_timeout(150); print('why:', ' / '.join(await a.locator('#pkAdvice li').all_inner_texts())[:200])
                await a.screenshot(path='poker5_coach.png'); shots=1; await a.click('#pkAdvice button')
            if await a.is_enabled('#pkCall') and await a.is_visible('#pkCall'):
                if acted==1 and await a.is_enabled('#pkBet'):
                    await a.click('#pkBet'); await a.wait_for_timeout(150); await a.screenshot(path='poker6_raise.png')
                    print('raise row:', await a.text_content('#pkRaiseAmt'), '| button:', await a.text_content('#pkBet')); await a.click('#pkRaise [data-size="min"]'); await a.click('#pkBet')
                else: await a.click('#pkCall')
                acted+=1
            elif await a.is_visible('#pkNext'):
                if await a.is_visible('#pkCoach') and not reviewed:
                    print('after the hand:', await a.text_content('#pkCoach'), '|', ' / '.join(await a.locator('.pk-won').all_inner_texts()))
                    await a.screenshot(path='poker7_showdown.png')
                    await a.click('#pkCoach'); await a.wait_for_timeout(150); print('review rows', await a.locator('#pkReviewList li').count()); await a.screenshot(path='poker8_review.png'); await a.click('#pkReviewClose'); reviewed=True
                if acted>=5 and reviewed: break
                await a.click('#pkNext')
        print('solo: my actions', acted, '| reviewed', reviewed, '|', await status(a))
        m=await a.evaluate("() => ({scroll: document.documentElement.scrollHeight - innerHeight, side: Math.max(...[...document.querySelectorAll('#poker *')].map(e => e.getBoundingClientRect().right)) - innerWidth, bottom: document.getElementById('pokerActions').getBoundingClientRect().bottom - innerHeight})")
        print('fits 390x844:', m, 'OK' if m['scroll']<=0 and m['side']<=0.5 and m['bottom']<=0.5 else 'PROBLEM')
        await a.click('#pkEndGame'); await a.wait_for_selector('#pkEndOverlay:not(.hidden)'); print('ended:', await a.text_content('#pkEndTitle'), '|', await a.text_content('#pkEndSub'), '| rows', await a.locator('#pkEndList li').count())
        await a.screenshot(path='poker9_end.png'); await a.click('#pkEndClose'); print('closed: play again', await a.is_visible('#pkAgain'))
        await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)'); print('quit: back on the poker tab', await a.get_attribute(TAB,'aria-selected'))

        # a table with friends
        k=await page('Kiran'); r=await page('Ravi')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); code=(await a.text_content('#lobbyCode')).strip()
        print('waiting room:', await a.text_content('#lobbyGame'), '| poker settings', await a.is_visible('#pkChipsInput'), '| others hidden', not await a.is_visible('#ludoBlocks') and not await a.is_visible('#handSizeInput'), '| coach off by default', not await a.is_checked('#pkCoachInput'), '| reactions off', not await a.is_checked('#reactionsInput'))
        await k.wait_for_timeout(400); print('card-game tab lists it:', await k.locator('#roomList li').count(), end=' | ')
        await k.click(TAB); await k.wait_for_timeout(300); print('poker tab lists it:', await k.locator('#roomList li').count())
        await k.click('#roomList li button'); await k.wait_for_selector('#lobby:not(.hidden)')
        await r.goto(BASE+'?room='+code); await r.wait_for_timeout(600); await r.click('#inviteJoin'); await r.wait_for_selector('#lobby:not(.hidden)')
        await a.check('#pkCoachInput'); await a.check('#reactionsInput'); await a.select_option('#turnTimeInput','0'); await a.wait_for_timeout(250)
        print('guest sees:', await k.text_content('#guestSettings'))
        await a.screenshot(path='poker10_waiting.png', full_page=True)
        # deal order with 3 players: Kiran (small blind), Ravi (big blind), Arun (button). Arun gets aces, Kiran kings.
        hit(f'__test/deck?room={code}&cards=Kh,Kd,7c,2d,As,Ah,Qs,8d,3c,5h,9s')
        await a.click('#startBtn'); await a.wait_for_selector('#poker:not(.hidden)'); await k.wait_for_selector('#poker:not(.hidden)'); await a.wait_for_timeout(500)
        print('Arun:', await status(a), '|', await a.text_content('.pk-what'), '| sees others face down', await a.locator('.pk-seat .pc.back').count(), '| Kiran:', await k.text_content('.pk-what'), '|', await status(k))
        print('nothing leaks: Kiran\'s page holds no ace', await k.evaluate("() => !document.getElementById('poker').innerText.includes('A\\n♠')"), '| button on Arun', await a.locator('#pkMe .pk-d').count()==1)
        await a.click('#pkBet'); await a.click('#pkRaise [data-size="1"]'); amt=await a.text_content('#pkBet'); await a.click('#pkBet'); await a.wait_for_timeout(500)
        print('Arun:', amt, '| Kiran:', await status(k), '| call button:', await k.text_content('#pkCall'))
        await k.click('#pkCall'); await r.wait_for_timeout(500); await r.click('#pkFold'); await a.wait_for_timeout(1200)
        print('flop:', await a.locator('#pkBoard .pc:not(.slot)').count(), '| pot', await a.text_content('#pkPot'), '| Kiran to act', await status(k), '| Ravi:', await status(r))
        await k.screenshot(path='poker11_flop.png')
        # reactions, chat, shared row
        print('shared row on the poker screen:', await a.evaluate("document.querySelector('.act-side').parentNode.id"), '| mic', await a.is_visible('#micBtn'), '| reactions', await a.is_visible('#reactBtn'), '| info:', await a.text_content('#myInfo'))
        await a.click('#reactBtn'); await a.click('#reactTray .react-pick >> nth=1'); await k.wait_for_timeout(500); print('reaction seen by Kiran:', await k.locator('.react-float.main').count())
        await a.click('#chatTab'); await a.fill('#chatInput','nice hand'); await a.press('#chatInput','Enter'); await a.click('#chatClose'); await k.wait_for_timeout(400); print('chat dot for Kiran:', await k.is_visible('#chatDot'))
        # a watcher mid-hand
        w=await page('Priya'); await w.click(TAB); await w.wait_for_timeout(300); await w.click('#roomList li button'); await w.wait_for_selector('#poker:not(.hidden)'); await w.wait_for_timeout(400)
        print('watcher:', await status(w), '| no buttons', not await w.is_visible('#pkCall'), '| sees no hole cards', await w.locator('.pc:not(.back):not(.slot)').count()==3, '| Arun sees:', await a.text_content('#pkWatchers'))
        await k.click('#pkCall'); await a.wait_for_timeout(500); await a.click('#pkCall'); await a.wait_for_timeout(1000)   # check, check
        await k.click('#pkCall'); await a.wait_for_timeout(500); await a.click('#pkCall'); await a.wait_for_timeout(1000)   # turn
        await k.click('#pkCall'); await a.wait_for_timeout(500); await a.click('#pkCall'); await a.wait_for_timeout(1600)   # river → showdown
        print('showdown:', ' / '.join(await a.locator('.pk-won').all_inner_texts()), '| Kiran\'s cards shown to Arun', await a.locator('.pk-seat .pc.mini:not(.back)').count(), '| highlighted', await a.locator('.pc.hl').count(), '| Arun review:', await a.text_content('#pkCoach'))
        await a.screenshot(path='poker12_show.png')
        print('Kiran cannot deal early', not await k.is_visible('#pkNext'), '| host can', await a.is_visible('#pkNext'), '|', await status(k))
        await a.click('#pkNext'); await a.wait_for_timeout(900)
        print('next hand: Priya seated', await w.locator('#pkMe .pc.big:not(.slot)').count()==2, '| players at Arun\'s table', 1+await a.locator('.pk-seat').count(), '|', await status(w))
        # sizes
        for (wd,ht) in [(320,568),(360,600),(390,780),(412,860),(1280,720)]:
            await w.set_viewport_size({'width':wd,'height':ht}); await w.wait_for_timeout(300)
            m=await w.evaluate("() => { const els=[...document.querySelectorAll('#poker .pk-wrap, #poker .pk-wrap *, #pokerActions, #pokerActions *, #pkStatus, #pkCoach')].filter(e => e.offsetParent); const r=e=>e.getBoundingClientRect(); const seats=[...document.querySelectorAll('.pk-seat')].map(r); const mid=r(document.querySelector('.pk-board')); const overlap=seats.some(a => !(a.right<=mid.left||a.left>=mid.right||a.bottom<=mid.top||a.top>=mid.bottom)); return { scroll: document.documentElement.scrollHeight-innerHeight, side: Math.round(Math.max(...els.map(e => r(e).right))-innerWidth), left: Math.round(Math.min(...els.map(e => r(e).left))), bottom: Math.round(r(document.getElementById('pokerActions')).bottom-innerHeight), table: Math.round(r(document.getElementById('pkTable')).height), overlap, btn: Math.round(r(document.getElementById('pkCall')).height) } }")
            print(f'{wd}x{ht}:', m, 'OK' if m['scroll']<=0 and m['side']<=0 and m['left']>=0 and m['bottom']<=0 and not m['overlap'] and m['btn']>=48 and m['table']>=150 else 'PROBLEM')
            if (wd,ht)==(320,568): await w.screenshot(path='poker13_small.png')
            if (wd,ht)==(1280,720): await w.screenshot(path='poker14_wide.png')
        await a.screenshot(path='poker15_four.png')
        # leaving mid-hand folds; ending the game
        await r.click('#leaveBtn'); await r.wait_for_selector('#home:not(.hidden)'); await a.wait_for_timeout(500)
        print('Ravi left mid-hand: back on poker tab', await r.get_attribute(TAB,'aria-selected'))
        for _ in range(12):
            if await a.is_visible('#pkNext'): break
            for q in (a,k,w):
                if await q.is_visible('#pkCall') and await q.is_enabled('#pkCall'): await q.click('#pkCall'); break
            await a.wait_for_timeout(600)
        print('hand finished without Ravi:', await a.is_visible('#pkNext'), '| seats now', 1+await a.locator('.pk-seat:not(.away)').count())
        await a.click('#pkEndGame'); await k.wait_for_selector('#pkEndOverlay:not(.hidden)')
        print('game over for Kiran:', await k.text_content('#pkEndTitle'), '| rows', await k.locator('#pkEndList li').count(), '| waits for host', await k.is_visible('#pkEndWait'), '| nets:', await k.locator('#pkEndList li span').all_inner_texts())
        await a.click('#pkEndAgain'); await a.wait_for_timeout(700); print('new game:', await status(a), '| hand', await a.text_content('.pk-street'))
        # turn timer: nobody acts, the game folds or checks for them
        t1=await page('Tara'); t2=await page('Uma')
        await t1.click(TAB); await t1.click('#createBtn'); await t1.wait_for_selector('#lobby:not(.hidden)'); c2=(await t1.text_content('#lobbyCode')).strip()
        await t2.goto(BASE+'?room='+c2); await t2.wait_for_timeout(600); await t2.click('#inviteJoin'); await t2.wait_for_selector('#lobby:not(.hidden)')
        print('joined by link:', await t2.text_content('#lobbyGame'), '| coach hidden when off:', end=' ')
        await t1.select_option('#turnTimeInput','10'); await t1.wait_for_timeout(200); await t1.click('#startBtn'); await t1.wait_for_selector('#poker:not(.hidden)'); await t1.wait_for_timeout(1500)
        print(not await t1.is_visible('#pkCoach') and not await t2.is_visible('#pkCoach'), '| clock:', await status(t1), '/', await status(t2), '| bar', await t1.locator('#poker .timing').count())
        await t1.wait_for_timeout(11000); print('after 10 s:', await status(t1), '/', await status(t2), '| toast:', repr(await t1.text_content('#toast')), '| table says:', await t2.locator('.pk-won').all_inner_texts())
        await t2.evaluate("document.body.classList.add('lefty')"); await t2.wait_for_timeout(200); await t2.screenshot(path='poker16_lefty.png')
        print('errors', errs); await b.close()
asyncio.run(main())
