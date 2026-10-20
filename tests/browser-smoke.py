"""Optional real Chromium smoke test for the standalone DSH fixture (NOT a live DSH host).
Requires Python Playwright + a Chromium executable. Run after `npm run build`.
"""
import json, os, subprocess, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = subprocess.Popen(['node', 'scripts/preview.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
checks = []
try:
    for _ in range(50):
        try:
            urllib.request.urlopen('http://127.0.0.1:4173/', timeout=1)
            break
        except Exception:
            time.sleep(.1)
    with sync_playwright() as p:
        executable = os.environ.get('CHROMIUM_PATH')
        if not executable and Path('/usr/bin/chromium').exists(): executable = '/usr/bin/chromium'
        browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1280, 'height': 900}, timezone_id='Asia/Shanghai')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.clock.install(time=datetime(2026, 10, 19, 2, 0, tzinfo=timezone.utc))
        page.clock.pause_at(datetime(2026, 10, 19, 2, 0, tzinfo=timezone.utc))
        page.goto('http://127.0.0.1:4173/')
        page.wait_for_selector('#dsh-mo-widget')
        page.locator('#settings').click()
        page.locator('[name=monthlySalary]').fill('8000')
        page.locator('#form button[type=submit]').click()
        page.wait_for_function("document.querySelector('#dsh-mo-widget').shadowRoot.querySelector('#state').textContent.includes('空闲')")
        checks.append('first-run configuration')
        page.evaluate("__moyuDemo.act('a-run')")
        page.clock.run_for(4999)
        assert page.locator('#paid').inner_text() == '00:00:00'
        page.clock.run_for(2001)
        assert page.locator('#paid').inner_text() == '00:00:02'
        checks.append('5-second threshold and live earnings')
        page.evaluate("__moyuDemo.act('a-wait')")
        before = page.locator('#paid').inner_text()
        page.clock.run_for(10000)
        assert page.locator('#paid').inner_text() == before
        checks.append('approval blocks even while running=true')
        page.evaluate("__moyuDemo.act('a-run')")
        page.clock.run_for(10000)
        assert page.locator('#paid').inner_text() == '00:00:07'
        page.evaluate("__moyuDemo.act('b-run')")
        page.clock.run_for(7000)
        assert page.locator('#paid').inner_text() == '00:00:14'
        checks.append('parallel sessions deduplicated')
        page.evaluate("__moyuDemo.act('offline')")
        page.clock.run_for(20000)
        assert page.locator('#paid').inner_text() == '00:00:14'
        page.evaluate("__moyuDemo.act('online')")
        page.clock.run_for(6000)
        assert page.locator('#paid').inner_text() == '00:00:15'
        checks.append('disconnect and reconnect do not backfill')
        page.evaluate("__moyuDemo.act('a-idle');__moyuDemo.act('b-idle')")
        expected = page.locator('#paid').inner_text()
        page.reload()
        page.wait_for_function("document.querySelector('#dsh-mo-widget').shadowRoot.querySelector('#state').textContent.includes('空闲')")
        assert page.locator('#paid').inner_text() == expected
        checks.append('reload restores confirmed intervals')
        page2 = context.new_page()
        page2.clock.install(time=datetime(2026, 10, 19, 2, 1, tzinfo=timezone.utc))
        page2.goto('http://127.0.0.1:4173/')
        page2.wait_for_selector('#dsh-mo-widget')
        assert '只读' in page2.locator('#state').inner_text()
        assert page2.evaluate('__moyuDemo.status.listeners.size') == 0
        checks.append('second tab cannot become a duplicate writer')
        page2.close()
        page.locator('#collapse').click()
        assert page.locator('#reopen').is_visible()
        page.locator('#reopen').click()
        assert page.locator('#paid').is_visible()
        page.locator('#history').click()
        assert page.locator('#rows tr').count() == 7
        page.locator('#back2').click()
        checks.append('collapse, expand and seven-day history')
        # Representative screenshot: seeded demo records only, no real salary data.
        page.evaluate("""() => { const v=JSON.parse(localStorage.getItem('dsh-mo:v1'));const now=Date.now();v.intervals=[{start:now-45*60000,end:now}];localStorage.setItem('dsh-mo:v1',JSON.stringify(v)); }""")
        page.reload()
        page.wait_for_function("document.querySelector('#dsh-mo-widget').shadowRoot.querySelector('#state').textContent.includes('空闲')")
        page.screenshot(path=str(ROOT / 'docs' / 'preview.png'), full_page=True)
        page.evaluate('__moyuDemo.dispose()')
        assert page.locator('#dsh-mo-widget').count() == 0
        assert page.evaluate('__moyuDemo.status.listeners.size') == 0
        checks.append('unload disposes widget and subscriptions')
        assert not errors, errors
        browser.close()
    print(json.dumps({'passed': len(checks), 'checks': checks, 'browser_errors': errors}, ensure_ascii=False, indent=2))
finally:
    server.terminate()
    server.wait(timeout=5)
