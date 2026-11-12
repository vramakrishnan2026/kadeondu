import asyncio
from playwright.async_api import async_playwright
async def run(b, grant, label):
    ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, permissions=['microphone'] if grant else [])
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto('http://localhost:8788/'); await pg.fill('#nameInput','Vinay'); await pg.click('#nameGo'); await pg.click('#createBtn'); await pg.wait_for_selector('#lobby:not(.hidden)')
    code=(await pg.text_content('#lobbyCode')).strip()
    q=await (await b.new_context()).new_page(); await q.goto('http://localhost:8788/?room='+code); await q.fill('#nameInput','Friend'); await q.click('#nameGo'); await q.wait_for_selector('#lobby:not(.hidden)')
    await pg.click('#startBtn'); await pg.wait_for_selector('#game:not(.hidden)'); await pg.wait_for_timeout(300)
    print(label, '| enable button shown:', await pg.is_visible('#micEnable'), '|', await pg.text_content('#micEnable'))
    if not await pg.is_visible('#micEnable'): print(label, '| already allowed, so no button (correct)'); await ctx.close(); return
    await pg.click('#micEnable'); await pg.wait_for_timeout(800)
    print(label, '| after tap: button shown', await pg.is_visible('#micEnable'), '| help open', await pg.is_visible('#micHelp'), '| toast', await pg.text_content('#toast'))
    if await pg.is_visible('#micHelp'): await pg.screenshot(path='mic_help.png')
    print(label, 'errors', errs); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']); await run(b, True, 'ALLOWED'); await b.close()
        b=await p.chromium.launch(args=['--use-fake-device-for-media-stream','--deny-permission-prompts']); await run(b, False, 'BLOCKED'); await b.close()
asyncio.run(main())
