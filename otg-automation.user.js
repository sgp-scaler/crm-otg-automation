// ==UserScript==
// @name         Scaler CRM - OTG Automation (Standalone)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Standalone OTG logging automation
// @match        https://sales.crm.scaler.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/sgp-scaler/crm-otg-automation/main/otg-automation.user.js
// @downloadURL  https://raw.githubusercontent.com/sgp-scaler/crm-otg-automation/main/otg-automation.user.js
// ==/UserScript==

(() => {
    'use strict';

    const BUTTON_ID = 'crm-otg-standalone-btn';
    const MENU_ID = 'crm-otg-standalone-menu';

    // Delay between CRM interactions.
    const ACTION_DELAY = 350;

    const REASONS = [
        { label: 'Student', value: 'Student / No degree' },
        { label: 'No English Proficiency', value: 'No English proficiency' },
        {
            label: 'Irrelevant Profile',
            value: 'Irrelevant profile to any Scaler Program'
        },
        { label: 'Unemployed', value: 'Unemployed' }
    ];

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    const isVisible = el =>
        !!el &&
        el.getClientRects().length > 0 &&
        getComputedStyle(el).visibility !== 'hidden' &&
        getComputedStyle(el).display !== 'none';

    async function waitFor(fn, description, timeout = 9000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const value = fn();
            if (value) return value;
            await sleep(150);
        }

        throw new Error(`Timed out waiting for ${description}`);
    }

    function getDrawer() {
        return [...document.querySelectorAll('.ant-drawer-content')]
            .find(el =>
                isVisible(el) &&
                el.querySelector('.ant-drawer-title')
                    ?.textContent.trim() === 'Call Attempted'
            );
    }

    function normalizeLabel(text) {
        return text
            .replace(/\*/g, '')
            .replace(/:/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function itemByLabel(root, names) {
        const expectedNames = names.map(normalizeLabel);

        const labels = [
            ...root.querySelectorAll('.ant-form-item-label label')
        ];

        const label = labels.find(el =>
            expectedNames.includes(normalizeLabel(el.textContent))
        );

        return label?.closest('.ant-form-item') || null;
    }

    // Wait for the actual radio input to render before interacting.
    async function selectRadio(root, labelNames, value) {
        const result = await waitFor(() => {
            const item = itemByLabel(root, labelNames);

            if (!item) return null;

            const input = [
                ...item.querySelectorAll(
                    'input.ant-radio-button-input, input[type="radio"]'
                )
            ].find(el => el.value === value);

            return input ? { item, input } : null;
        }, `${labelNames[0]} radio option "${value}"`, 9000);

        let { input } = result;

        // Give the CRM a moment before clicking.
        await sleep(ACTION_DELAY);

        // Recheck the live DOM in case React has re-rendered the field.
        const currentItem = itemByLabel(root, labelNames);

        input = currentItem
            ? [...currentItem.querySelectorAll(
                'input.ant-radio-button-input, input[type="radio"]'
              )].find(el => el.value === value)
            : null;

        if (!input) {
            throw new Error(
                `Radio input "${value}" disappeared from ${labelNames[0]}`
            );
        }

        if (!input.checked) {
            const wrapper = input.closest(
                'label.ant-radio-button-wrapper'
            );

            if (!wrapper) {
                throw new Error(
                    `Clickable radio wrapper not found for ${labelNames[0]}: ${value}`
                );
            }

            wrapper.click();

            // Allow React / Ant Design to update its selected state.
            await sleep(ACTION_DELAY);
        }

        // Re-query the DOM while waiting for the checked state.
        await waitFor(() => {
            const updatedItem = itemByLabel(root, labelNames);

            const updatedInput = updatedItem
                ? [...updatedItem.querySelectorAll(
                    'input.ant-radio-button-input, input[type="radio"]'
                  )].find(el => el.value === value)
                : null;

            return updatedInput?.checked;
        }, `${labelNames[0]} = ${value}`, 5000);

        console.log(`[OTG] Selected ${labelNames[0]}: ${value}`);
    }

    async function setConversation(root) {
        const item = await waitFor(
            () => itemByLabel(root, ['Conversation Details']),
            'Conversation Details'
        );

        await sleep(ACTION_DELAY);

        const textarea = item.querySelector('textarea');

        if (!textarea) {
            throw new Error('Conversation Details textarea not found');
        }

        const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value'
        ).set;

        setter.call(textarea, 'OTG');

        textarea.dispatchEvent(
            new Event('input', { bubbles: true })
        );

        textarea.dispatchEvent(
            new Event('change', { bubbles: true })
        );

        await sleep(ACTION_DELAY);

        await waitFor(
            () => textarea.value === 'OTG',
            'OTG conversation text'
        );

        console.log('[OTG] Conversation Details: OTG');
    }

    // UPDATED: Open and select the Reason for Junk dropdown.
    async function setJunkReason(root, value) {
        const item = await waitFor(
            () => itemByLabel(root, ['Reason for Junk']),
            'Reason for Junk'
        );

        await sleep(ACTION_DELAY);

        const select = item.querySelector('.ant-select');

        if (!select) {
            throw new Error('Reason for Junk dropdown not found');
        }

        const selector =
            select.querySelector('.ant-select-selector') || select;

        // Focus the search input if Ant Design has rendered one.
        const searchInput = select.querySelector(
            'input.ant-select-selection-search-input'
        );

        if (searchInput) {
            searchInput.focus();
        }

        // Ant Design Select commonly handles opening on mousedown.
        selector.dispatchEvent(
            new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                buttons: 1
            })
        );

        await sleep(ACTION_DELAY);

        selector.dispatchEvent(
            new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0
            })
        );

        selector.dispatchEvent(
            new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0
            })
        );

        // Wait for the Select or its popup to become open.
        await waitFor(
            () => {
                const opened =
                    select.classList.contains('ant-select-open') ||
                    select.getAttribute('aria-expanded') === 'true';

                const popupVisible = [
                    ...document.querySelectorAll('.ant-select-dropdown')
                ].some(dropdown =>
                    !dropdown.classList.contains(
                        'ant-select-dropdown-hidden'
                    ) && isVisible(dropdown)
                );

                return opened || popupVisible;
            },
            'Reason for Junk dropdown to open',
            7000
        );

        // Search only visible dropdowns and actual rendered options.
        const option = await waitFor(
            () => {
                const visibleDropdowns = [
                    ...document.querySelectorAll('.ant-select-dropdown')
                ].filter(dropdown =>
                    !dropdown.classList.contains(
                        'ant-select-dropdown-hidden'
                    ) && isVisible(dropdown)
                );

                for (const dropdown of visibleDropdowns) {
                    const found = [
                        ...dropdown.querySelectorAll(
                            '.rc-virtual-list-holder-inner .ant-select-item-option'
                        )
                    ].find(el =>
                        el.getAttribute('title') === value &&
                        isVisible(el)
                    );

                    if (found) return found;
                }

                return null;
            },
            `visible junk reason option "${value}"`,
            7000
        );

        await sleep(ACTION_DELAY);

        console.log('[OTG] Clicking junk reason:', value);

        option.click();

        await sleep(ACTION_DELAY);

        await waitFor(() => {
            const selected = select.querySelector(
                '.ant-select-selection-item'
            );

            return selected &&
                selected.textContent.trim() === value;
        }, `junk reason selected: ${value}`, 5000);

        console.log('[OTG] Reason selected:', value);
    }

    async function runOTG(reason) {
        try {
            console.log('[OTG] Starting:', reason.value);

            // STEP 1: Click Processes.
            const processes = await waitFor(
                () => [...document.querySelectorAll('button')]
                    .find(el =>
                        isVisible(el) &&
                        el.textContent.trim() === 'Processes'
                    ),
                'Processes button'
            );

            processes.click();
            await sleep(ACTION_DELAY);

            // STEP 2: Select Call Attempted.
            const callAttempted = await waitFor(
                () => [
                    ...document.querySelectorAll(
                        '.ant-dropdown-menu-item, [role="menuitem"]'
                    )
                ].find(el =>
                    isVisible(el) &&
                    el.textContent.trim().includes('Call Attempted')
                ),
                'Call Attempted menu option'
            );

            callAttempted.click();
            await sleep(ACTION_DELAY);

            // STEP 3: Wait for drawer.
            const root = await waitFor(
                getDrawer,
                'Call Attempted drawer'
            );

            await sleep(ACTION_DELAY);

            // STEP 4: Fill fields.
            await selectRadio(
                root,
                ['Call Connected'],
                'Yes'
            );

            await selectRadio(
                root,
                ['Lead Vertical'],
                'Academy'
            );

            await setConversation(root);

            await selectRadio(
                root,
                ['Target Group'],
                'No'
            );

            await setJunkReason(root, reason.value);

            // STEP 5: Validate all fields before submission.
            const call = itemByLabel(root, ['Call Connected']);
            const vertical = itemByLabel(root, ['Lead Vertical']);
            const details = itemByLabel(root, ['Conversation Details']);
            const target = itemByLabel(root, ['Target Group']);
            const junk = itemByLabel(root, ['Reason for Junk']);

            const valid =
                call?.querySelector('input[value="Yes"]')?.checked &&
                vertical?.querySelector('input[value="Academy"]')?.checked &&
                details?.querySelector('textarea')?.value === 'OTG' &&
                target?.querySelector('input[value="No"]')?.checked &&
                junk?.querySelector(
                    '.ant-select-selection-item'
                )?.textContent.trim() === reason.value;

            if (!valid) {
                throw new Error(
                    'Final field validation failed. Submit was not attempted.'
                );
            }

            console.log('[OTG] All fields validated.');

            // STEP 6: Find Submit.
            const submit = [
                ...root.querySelectorAll('.ant-drawer-footer button')
            ].find(el =>
                isVisible(el) &&
                el.textContent.trim() === 'Submit' &&
                !el.disabled
            );

            if (!submit) {
                throw new Error('Submit button not found or disabled.');
            }

            // STEP 7: Final confirmation.
            const confirmed = window.confirm(
                `Please confirm OTG entry:\n\n` +
                `Call Connected: Yes\n` +
                `Lead Vertical: Academy\n` +
                `Conversation Details: OTG\n` +
                `Target Group: No\n` +
                `Reason: ${reason.value}\n\n` +
                `Submit this entry?`
            );

            if (!confirmed) {
                console.log('[OTG] User cancelled submission.');
                return;
            }

            submit.click();

            console.log('[OTG] Submit clicked:', reason.value);

            await waitFor(
                () => !getDrawer(),
                'Call Attempted drawer to close',
                10000
            );
            console.log(`[OTG] Submitted: ${reason.label}`);

        } catch (err) {
            console.error('[OTG] Stopped safely:', err);

            alert(
                `OTG automation stopped.\n\n` +
                `${err.message}\n\n` +
                `Please inspect the CRM form.`
            );
        }
    }

    function closeMenu() {
        document.getElementById(MENU_ID)?.remove();
    }

    function createButton() {
        if (document.getElementById(BUTTON_ID)) return;

        const button = document.createElement('button');

        button.id = BUTTON_ID;
        button.textContent = '🚫 OTG';

        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 450px;
            z-index: 999999;
            padding: 12px 18px;
            background: #cf1322;
            color: #fff;
            border: 0;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 700;
            box-shadow: 0 4px 10px rgba(0,0,0,.2);
        `;

        button.addEventListener('click', event => {
            event.stopPropagation();

            if (document.getElementById(MENU_ID)) {
                closeMenu();
                return;
            }

            const menu = document.createElement('div');

            menu.id = MENU_ID;

            menu.style.cssText = `
                position: fixed;
                top: 166px;
                right: 350px;
                z-index: 1000000;
                min-width: 220px;
                padding: 6px;
                background: #fff;
                color: #222;
                border: 1px solid #d9d9d9;
                border-radius: 8px;
                box-shadow: 0 6px 18px rgba(0,0,0,.18);
            `;

            REASONS.forEach(reason => {
                const option = document.createElement('button');

                option.type = 'button';
                option.textContent = reason.label;

                option.style.cssText = `
                    display: block;
                    width: 100%;
                    padding: 11px 12px;
                    text-align: left;
                    background: #fff;
                    color: #333;
                    border: 0;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 13px;
                `;

                option.addEventListener('mouseenter', () => {
                    option.style.background = '#f3f3f3';
                });

                option.addEventListener('mouseleave', () => {
                    option.style.background = '#fff';
                });

                option.addEventListener('click', async () => {
                    closeMenu();

                    button.disabled = true;
                    button.style.opacity = '0.6';
                    button.style.cursor = 'wait';

                    try {
                        await runOTG(reason);
                    } finally {
                        button.disabled = false;
                        button.style.opacity = '1';
                        button.style.cursor = 'pointer';
                    }
                });

                menu.appendChild(option);
            });

            document.body.appendChild(menu);
        });

        document.addEventListener('click', event => {
            const menu = document.getElementById(MENU_ID);

            if (
                menu &&
                !menu.contains(event.target) &&
                event.target !== button
            ) {
                closeMenu();
            }
        });

        document.body.appendChild(button);
    }

    const init = setInterval(() => {
        if (document.body) {
            createButton();
            clearInterval(init);
        }
    }, 300);

    console.log('[OTG] Standalone script v1.4 loaded.');

})();
