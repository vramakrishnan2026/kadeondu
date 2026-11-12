import asyncio
from playwright.async_api import async_playwright
CHECK="""() => {
  const ring=document.getElementById('ring').getBoundingClientRect();
  const top=document.querySelector('.topbar').getBoundingClientRect();
  const seats=[...document.querySelectorAll('#seats .seat')].map(s=>s.getBoundingClientRect());
  const hand=document.getElementById('hand').getBoundingClientRect();
  const out=seats.filter(r=>r.top<top.bottom-1||r.bottom>window.innerHeight||r.left<-1||r.right>window.innerWidth+1).length;
  return {scroll: document.documentElement.scrollHeight - window.innerHeight, seatsCut: out, seats: seats.length,
          handBottom: Math.round(hand.bottom), vh: window.innerHeight, ringH: Math.round(ring.height)};
}"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for (w,h) in [(360,690),(390,780),(360,600),(412,860),(1280,720)]:
            for n in [1,3,9]:
                pg=await (await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2)).new_page()
                await pg.goto('http://localhost:8788/'); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#soloBtn')
                await pg.select_option('#soloCount',str(n)); await pg.select_option('#soloTime','0'); await pg.click('#soloStart'); await pg.wait_for_selector('#game:not(.hidden)'); await pg.wait_for_timeout(300)
                r=await pg.evaluate(CHECK); ok = r['scroll']<=0 and r['seatsCut']==0 and r['handBottom']<=r['vh']
                print(f'{w}x{h} players={n+1}: scroll={r["scroll"]} cut={r["seatsCut"]} handBottom={r["handBottom"]}/{r["vh"]} ringH={r["ringH"]} {"OK" if ok else "PROBLEM"}')
                if (w,h,n)==(360,690,3): await pg.screenshot(path='fit_360x690_4.png')
                if (w,h,n)==(360,600,9): await pg.screenshot(path='fit_360x600_10.png')
                await pg.context.close()
        # 20 players in a room
        pg=await (await b.new_context(viewport={'width':360,'height':690}, device_scale_factor=2)).new_page()
        await pg.goto('http://localhost:8788/'); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#createBtn'); await pg.wait_for_selector('#lobby:not(.hidden)')
        for _ in range(19): await pg.click('#addBotBtn'); await pg.wait_for_timeout(30)
        await pg.click('#startBtn'); await pg.wait_for_selector('#game:not(.hidden)'); await pg.wait_for_timeout(400)
        r=await pg.evaluate(CHECK); print('360x690 players=20:', r); await pg.screenshot(path='fit_20.png')
        await b.close()
asyncio.run(main())
