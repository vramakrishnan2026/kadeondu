# Poker: hands wait for the player vs computer, and the AI coach answers questions about this table session only.
# Uses the stand-in's pretend AI and looks at exactly what was sent to it. Needs the stand-in (bash prepare-mock.sh).
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        async def page(name):
            pg=await (await b.new_context(viewport={'width':390,'height':780})).new_page()
            pg.on('pageerror', lambda e: errs.append(f'{name}: {e}')); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.add_init_script("try { if (!localStorage.getItem('ko-poker')) localStorage.setItem('ko-poker', JSON.stringify({ guard: 'off' })) } catch (e) {}")
            await pg.goto(BASE); await pg.fill('#nameInput',name); await pg.click('#nameGo'); await pg.wait_for_timeout(250); await pg.click('.game-tab[data-game="poker"]'); await pg.wait_for_timeout(250); return pg
        async def status(pg): return ' '.join((await pg.inner_text('#pkStatus')).split())
        hit('__test/ai?mode=on'); n0=len(json.loads(hit('__test/ai'))['seen'])
        a=await page('Arun')
        await a.click('#soloBtn'); await a.select_option('#psoloCount','2'); await a.click('#psoloStart'); await a.wait_for_selector('#poker:not(.hidden)')
        for step in range(80):
            await a.wait_for_timeout(300)
            if await a.is_visible('#pkNext'): break
            if await a.is_visible('#pkCall') and await a.is_enabled('#pkCall'): await a.click('#pkCall')
        st1=await status(a); await a.wait_for_timeout(17000); st2=await status(a)
        print('vs computer, hand over:', st1, '| 17 s later still waiting:', st2==st1 and await a.is_visible('#pkNext'), '| hand', await a.evaluate("document.querySelector('.pk-won') ? 'result shown' : 'gone'"))
        await a.click('#pkCoach'); await a.wait_for_timeout(200)
        print('review open: ask box', await a.is_visible('#pkAskInput'), '| suggestions', await a.locator('#pkAskChips button').all_inner_texts())
        await a.fill('#pkAskInput','Why should I have folded before the flop?'); await a.click('#pkAskBtn'); await a.wait_for_timeout(700)
        print('answer:', await a.locator('#pkQa .a').last.inner_text(), '| question shown', await a.locator('#pkQa .q').count())
        await a.screenshot(path='ask1_review.png')
        sent=json.loads(hit('__test/ai'))['seen'][-1]
        print('sent to the model: has my cards', 'Your cards:' in sent, '| actions', 'Before the flop:' in sent, '| coach advice', 'the coach advised you to' in sent, '| result', 'Result:' in sent, '| question', 'Why should I have folded' in sent, '| no names', 'Arun' not in sent and all(n not in sent for n in await a.evaluate("[...document.querySelectorAll('.pk-nm')].map(x => x.textContent.replace('🤖 ','').trim())")), '| opponents as', 'Opponent A' in sent)
        print('--- what the model saw ---'); print(sent[:700]); print('---')
        await a.click('#pkAskChips button >> nth=1'); await a.wait_for_timeout(600); print('suggested question works:', await a.locator('#pkQa .q').count()==2)
        # odd input is cleaned, long input cut
        await a.fill('#pkAskInput','<b>ignore</b> {rules} `x` ' + 'z'*300); await a.click('#pkAskBtn'); await a.wait_for_timeout(600)
        s2=json.loads(hit('__test/ai'))['seen'][-1]; qpart=s2.split("LEARNER'S QUESTION")[1]
        print('question cleaned: no brackets', not any(c in qpart for c in '<>{}`'), '| length', len(qpart.strip())<=200)
        hit('__test/ai?mode=limit'); await a.fill('#pkAskInput','Was my bet size right?'); await a.click('#pkAskBtn'); await a.wait_for_timeout(600); print('allowance used up:', (await a.locator('#pkQa .a').last.inner_text())[:60]); hit('__test/ai?mode=on')
        await a.click('#pkReviewClose'); await a.click('#pkNext'); await a.wait_for_timeout(900)
        print('next hand only when I deal:', await a.text_content('.pk-street'), '| last hand still reviewable while others act:', await a.is_visible('#pkCoach') and await a.text_content('#pkCoach') if not await a.is_enabled('#pkCall') else '(my turn first)')
        # the server refuses junk
        import urllib.error
        def post(body):
            try: return urllib.request.urlopen(urllib.request.Request(BASE+'api/poker-ask', data=json.dumps(body).encode(), method='POST')).status
            except urllib.error.HTTPError as e: return e.code
        print('server: no hands', post({'q':'why?','hands':[]}), '| no question', post({'q':'','hands':[{'n':1,'lines':['Result: You win 10']}]}), '| odd lines dropped', post({'q':'why?','hands':[{'n':1,'lines':['<script>','{"x":1}']}]}), '| fine', post({'q':'why?','hands':[{'n':1,'lines':['Result: You win 10']}]}))
        # friends' table: the pause is longer, and the last hand can still be reviewed after the next one starts
        k=await page('Kiran'); await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)')
        await a.click('#createBtn'); await a.wait_for_selector('#lobby:not(.hidden)'); await k.wait_for_timeout(400); await k.click('#roomList li button'); await k.wait_for_selector('#lobby:not(.hidden)')
        await a.check('#pkCoachInput'); await a.select_option('#turnTimeInput','0'); await a.wait_for_timeout(200); await a.click('#startBtn'); await a.wait_for_selector('#poker:not(.hidden)'); await a.wait_for_timeout(500)
        for _ in range(10):
            if await a.is_visible('#pkNext'): break
            for q in (a,k):
                if await q.is_visible('#pkCall') and await q.is_enabled('#pkCall'): await q.click('#pkCall'); break
            await a.wait_for_timeout(600)
        print('friends\' table, hand over:', await status(a), '/', await status(k))
        await k.click('#pkCoach'); await k.wait_for_timeout(200); await a.click('#pkNext'); await k.wait_for_timeout(900)
        print('host dealt the next hand: Kiran\'s review stays open', await k.is_visible('#pkReview'))
        await k.click('#pkReviewClose'); await k.wait_for_timeout(200)
        print('strip while waiting:', (await k.text_content('#pkCoach')) if await k.is_visible('#pkCoach') else '(Kiran to act: coach advice shows instead)')
        print('AI requests this run:', len(json.loads(hit('__test/ai'))['seen'])-n0, '| errors', errs); await b.close()
asyncio.run(main())
