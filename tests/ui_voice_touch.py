import asyncio
from playwright.async_api import async_playwright
BASE='http://localhost:8788/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        errs=[]
        async def page(touch):
            ctx=await b.new_context(viewport={'width':390,'height':780}, device_scale_factor=2, permissions=['microphone'], has_touch=touch, is_mobile=touch)
            pg=await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return pg
        desk=await page(False); await desk.goto(BASE); await desk.fill('#nameInput','Vinay'); await desk.click('#nameGo'); await desk.click('#createBtn'); await desk.wait_for_selector('#lobby:not(.hidden)')
        code=(await desk.text_content('#lobbyCode')).strip()
        ph=await page(True); await ph.goto(BASE+'?room='+code); await ph.fill('#nameInput','Friend'); await ph.tap('#nameGo'); await ph.wait_for_selector('#lobby:not(.hidden)')
        await desk.click('#startBtn'); await ph.wait_for_selector('#game:not(.hidden)'); await ph.wait_for_timeout(400)
        await desk.evaluate("window.__voices=0; const P=HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play=function(){ if((this.src||'').startsWith('data:audio')) window.__voices++; return P.call(this)}; 0")
        cdp=await ph.context.new_cdp_session(ph)
        box=await ph.locator('#micBtn').bounding_box(); x,y=box['x']+box['width']/2, box['y']+box['height']/2
        async def hold(ms):
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            await ph.wait_for_timeout(ms)
            await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        await hold(1800); await ph.wait_for_timeout(1500)
        print('phone toast:', await ph.text_content('#toast'), '| desktop heard:', await desk.evaluate('window.__voices'))
        await ph.wait_for_timeout(2600); await hold(2000); await ph.wait_for_timeout(1500)
        print('second note: desktop heard total:', await desk.evaluate('window.__voices'))
        print('errors', errs); await b.close()
asyncio.run(main())
