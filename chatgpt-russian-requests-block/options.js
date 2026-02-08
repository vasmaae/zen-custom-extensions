document.addEventListener('DOMContentLoaded', async () => {
    const domainsEl = document.getElementById('blockedDomains');
    const regionsEl = document.getElementById('blockedRegions');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    const statusEl = document.getElementById('status');

    const loadSettings = async () => {
        try {
            const result = await browser.storage.local.get(['blockedDomains', 'blockedRegions']);

            domainsEl.value = (result.blockedDomains || ['chat.openai.com', 'chatgpt.com']).join('\n');
            regionsEl.value = (result.blockedRegions || ['RU']).join('\n');
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            showStatus('Не удалось загрузить настройки. Проверьте консоль.', false);
            domainsEl.value = 'chat.openai.com\nchatgpt.com';
            regionsEl.value = 'RU';
        }
    };

    const showStatus = (message, isSuccess) => {
        statusEl.textContent = message;
        statusEl.className = isSuccess ? 'status-success' : 'status-error';
        statusEl.style.display = 'block';

        if (isSuccess) {
            setTimeout(() => {
                statusEl.style.display = 'none';
            }, 3000);
        }
    };

    const saveSettings = async () => {
        try {
            const domains = domainsEl.value
                .split('\n')
                .map(d => d.trim().toLowerCase())
                .filter(d => d && !d.includes(' '))
                .filter((value, index, self) => self.indexOf(value) === index);

            const regions = regionsEl.value
                .split('\n')
                .map(r => r.trim().toUpperCase())
                .filter(r => r && /^[A-Z]{2}$/.test(r))
                .filter((value, index, self) => self.indexOf(value) === index);

            if (domains.length === 0) throw new Error('Список доменов не может быть пустым');
            if (regions.length === 0) throw new Error('Список регионов не может быть пустым');

            await browser.storage.local.set({
                blockedDomains: domains,
                blockedRegions: regions
            });

            showStatus('✅ Настройки успешно сохранены! Расширение обновлено.', true);
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            showStatus(`❌ ${error.message || 'Ошибка при сохранении настроек'}`, false);
        }
    };

    const resetSettings = () => {
        domainsEl.value = 'chat.openai.com\nchatgpt.com';
        regionsEl.value = 'RU';
        showStatus('Настройки сброшены к значениям по умолчанию. Не забудьте сохранить!', true);
    };

    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetSettings);

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveSettings();
        }
    });

    let hasUnsavedChanges = false;
    const checkChanges = () => {
        saveBtn.disabled = !hasUnsavedChanges;
        saveBtn.style.opacity = hasUnsavedChanges ? '1' : '0.7';
    };

    [domainsEl, regionsEl].forEach(el => {
        el.addEventListener('input', () => {
            hasUnsavedChanges = true;
            checkChanges();
        });
    });

    saveBtn.addEventListener('click', () => {
        hasUnsavedChanges = false;
        checkChanges();
    });

    await loadSettings();

    checkChanges();
});