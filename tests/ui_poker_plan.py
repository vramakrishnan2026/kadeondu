# Poker School, "Your plan": next step, revision quiz, AI coach's note (with the stand-in's pretend AI),
# habits from table play, the coach's nudge, and moving up a level. Needs the stand-in (bash prepare-mock.sh).
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
def hit(path): return urllib.request.urlopen(BASE+path).read().decode()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        a=await (await b.new_context(viewport={'width':390,'height':844})).new_page()
        a.on('pageerror', lambda e: errs.append(str(e))); a.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        hit('__test/ai?mode=on')
        TAB='.game-tab[data-game="poker"]'
        async def home():
            await a.goto(BASE); await a.wait_for_timeout(300)
            if await a.is_visible('#nameInput') and await a.is_visible('#nameGo'): await a.fill('#nameInput','Arun'); await a.click('#nameGo'); await a.wait_for_timeout(250)
            await a.click(TAB); await a.wait_for_timeout(300)
        async def plan(): return (await a.text_content('#pkNextTitle'), await a.text_content('#pkNextGo'))
        await home()
        print('new learner:', await plan(), '|', await a.locator('#pkStats span').all_inner_texts(), '| AI offered', await a.is_visible('#pkAiBtn'))
        # lesson 1, every quiz answer wrong
        await a.click('#pkNextGo'); await a.wait_for_selector('#school:not(.hidden)')
        n=await a.evaluate("POKER_LEARN.lessons.beginner[0].pages.length"); ans=await a.evaluate("POKER_LEARN.lessons.beginner[0].quiz.map(q => q.answer)")
        for _ in range(n): await a.click('#scFoot .primary')
        for k in ans: await a.click(f'.sc-opt >> nth={(k+1)%2}'); await a.click('#scFoot .primary')
        await a.click('#scFoot .ghost'); await a.wait_for_selector('#home:not(.hidden)')
        print('after a bad quiz:', await plan(), '|', await a.text_content('#pkNextWhy'), '|', await a.locator('#pkStats span').all_inner_texts(), '| AI offered', await a.is_visible('#pkAiBtn'))
        await a.screenshot(path='plan1_revise.png')
        # the AI note
        await a.click('#pkAiBtn'); await a.wait_for_timeout(700)
        note=await a.text_content('#pkAiText'); seen=json.loads(hit('__test/ai'))['seen']
        print('AI note:', note[:70], '| markup stripped', '*' not in note, '| label:', (await a.text_content('#pkAiBy'))[:40])
        print('sent to the model:', len(seen), 'request | no name in it', 'Arun' not in seen[-1], '| has numbers', 'Quiz answers right: 0%' in seen[-1] and 'What poker is' in seen[-1])
        await a.screenshot(path='plan2_ai.png')
        await a.click('#pkAiBtn'); await a.wait_for_timeout(400); print('same results: no second request', len(json.loads(hit('__test/ai'))['seen'])==len(seen))
        # revision quiz puts them right
        await a.click('#pkNextGo'); await a.wait_for_selector('#school:not(.hidden)'); print('revision:', await a.text_content('#scTitle'), '|', await a.text_content('#scStep'))
        for k in ans: await a.click(f'.sc-opt >> nth={k}'); await a.click('#scFoot .primary')
        print('revision done:', await a.text_content('.sc-h'), '|', await a.text_content('#scBody p'))
        await a.click('#scFoot .primary'); await a.wait_for_selector('#home:not(.hidden)')
        print('then:', await plan(), '| AI note hidden again (results changed)', not await a.is_visible('#pkAi'))
        # allowance used up, and AI switched off
        hit('__test/ai?mode=limit'); await a.click('#pkAiBtn'); await a.wait_for_timeout(600); print('limit:', (await a.text_content('#pkAiText'))[:62])
        hit('__test/ai?mode=off'); await a.click('#pkAiBtn'); await a.wait_for_timeout(600); print('off:', (await a.text_content('#pkAiText'))[:50]); hit('__test/ai?mode=on')
        # habits from the table: seed 20 decisions with a clear slip, then check the plan and the coach's nudge
        await a.evaluate("""() => { const p=JSON.parse(localStorage.getItem('ko-poker')); for (const l of POKER_LEARN.lessons.beginner) p.done[l.id]=l.quiz.length; p.miss={};
          for (const d of POKER_LEARN.drills.beginner) p.drills[d.id]={best:9,played:2,asked:20,right:17}; p.play={dec:20,match:9,opp:{loose:10,passive:6,wild:4},slip:{loose:7,passive:1}}; localStorage.setItem('ko-poker',JSON.stringify(p)) }""")
        await home()
        print('with a habit:', await plan(), '|', (await a.text_content('#pkHabit'))[:90], '|', await a.locator('#pkStats span').all_inner_texts(), '| level-up offered', await a.is_visible('#pkLevelUp'))
        await a.screenshot(path='plan3_habit.png')
        await a.click('#soloBtn'); await a.select_option('#psoloCount','5'); await a.click('#psoloStart'); await a.wait_for_selector('#poker:not(.hidden)')
        nudged=False
        for step in range(160):
            await a.wait_for_timeout(300)
            if await a.is_visible('#pkCoach') and await a.get_attribute('#pkCoach','data-mode')=='advice' and await a.is_enabled('#pkCall'):
                if 'Fold' in await a.text_content('#pkCoach'):
                    await a.click('#pkCoach'); await a.wait_for_timeout(150); nudged=await a.locator('#pkAdvice .pk-watch').count()==1
                    print('coach nudge on a fold spot:', await a.locator('#pkAdvice li').first.inner_text()); await a.screenshot(path='plan4_nudge.png'); await a.click('#pkAdvice button')
                    await a.click('#pkCall'); break
                await a.click('#pkFold') if await a.is_enabled('#pkFold') else await a.click('#pkCall')
            elif await a.is_visible('#pkNext'): await a.click('#pkNext')
        for _ in range(60):
            if await a.is_visible('#pkNext'): break
            if await a.is_visible('#pkFold') and await a.is_enabled('#pkFold'): await a.click('#pkFold')
            elif await a.is_enabled('#pkCall'): await a.click('#pkCall')
            await a.wait_for_timeout(300)
        await a.click('#pkCoach'); await a.wait_for_timeout(200); print('review marks the slip:', await a.locator('#pkReviewList .rv-habit').count()>=1, '| nudge shown', nudged)
        saved=await a.evaluate("JSON.parse(localStorage.getItem('ko-poker')).play"); print('counted on the phone:', saved['dec']>20, saved['slip'])
        await a.click('#pkReviewClose'); await a.click('#leaveBtn'); await a.wait_for_selector('#home:not(.hidden)')
        await a.click('#pkLevelUp'); await a.wait_for_timeout(300); print('moved up:', await a.get_attribute('.pk-level.on','data-level'), '| plan:', await plan())
        print('page scrolls sideways:', await a.evaluate('document.documentElement.scrollWidth > innerWidth'))
        print('errors', errs); await b.close()
asyncio.run(main())
