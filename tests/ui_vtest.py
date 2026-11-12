import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=no-user-gesture-required'])
        errs=[]
        async def pg():
            x=await (await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, permissions=['microphone','clipboard-read','clipboard-write'])).new_page()
            x.on('pageerror', lambda e: errs.append(str(e))); return x
        A=await pg(); await A.goto('http://localhost:8788/'); await A.fill('#nameInput','Vinay'); await A.click('#nameGo'); await A.click('.voicetest-link')
        await A.wait_for_selector('#env'); print('env:', (await A.text_content('#env')).replace('\n',' | ')[:200])
        await A.click('#askMic'); await A.wait_for_timeout(4500); print('mic:', await A.text_content('#micRes'))
        await A.click('#rec3'); await A.wait_for_timeout(3600); print('rec:', await A.text_content('#recRes'))
        await A.click('#playWa'); await A.wait_for_timeout(3500); print('play:', await A.text_content('#playRes'))
        B=await pg(); await B.goto('http://localhost:8788/voicetest.html'); await B.click('#pairJoin'); await A.click('#pairJoin'); await A.wait_for_timeout(800)
        print('A sees:', (await A.text_content('#pairWho')).replace(chr(10),' | ')); print('B before recording:', await B.text_content('#pairRes')); await A.click('#pairSend'); await B.wait_for_timeout(4500); print('other phone:', await B.text_content('#pairRes'))
        await A.screenshot(path='vtest.png', full_page=True)
        await A.click('#copy'); rep=await A.evaluate('navigator.clipboard.readText()'); print('report lines:', len(rep.splitlines()))
        print('errors', errs); await b.close()
asyncio.run(main())
