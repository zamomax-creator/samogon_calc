"use strict";

// ==========================================
// Логика переключения тем (Light/Dark Glassmorphism)
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeButton(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const btn = document.getElementById('theme-btn');
    if (theme === 'dark') {
        btn.innerText = '☀️ Светлая';
    } else {
        btn.innerText = '🌙 Темная';
    }
}

// Запускаем проверку темы при загрузке скрипта
initTheme();

// Переключение вкладок интерфейса
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Переключение единиц измерения для Разбавления
function setDilUnit(unit) {
    // Меняем активную кнопку визуально
    document.getElementById('btn-dil-l').classList.remove('active');
    document.getElementById('btn-dil-ml').classList.remove('active');
    document.getElementById('btn-dil-' + unit).classList.add('active');
    
    // Записываем значение в скрытое поле
    document.getElementById('dil-unit').value = unit;
    
    // Запускаем пересчет
    convertDilutionInputs();
}

// Переключение единиц измерения для Дробного перегона
function setFracUnit(unit) {
    document.getElementById('btn-frac-l').classList.remove('active');
    document.getElementById('btn-frac-ml').classList.remove('active');
    document.getElementById('btn-frac-' + unit).classList.add('active');
    
    document.getElementById('frac-unit').value = unit;
    convertFractionInputs();
}

// Вспомогательная функция округления для вывода на экран
function displayRound(value, decimals = 3) {
    return value.toFixed(decimals);
}

// 1. Запуск температурной коррекции
function runCorrection() {
    const strength = parseFloat(document.getElementById('corr-strength').value) || 0;
    const temp = parseFloat(document.getElementById('corr-temp').value) || 0;
    
    const trueStrength = OIML.getTrueStrength(strength, temp);
    
    document.getElementById('val-true-strength').innerText = displayRound(trueStrength, 2) + " % об.";
    document.getElementById('res-correction').style.display = 'block';
}

// 2. Запуск расчета разбавления
// Храним текущую единицу измерения, чтобы знать, как конвертировать при переключении селектора
let currentDilUnit = 'l';

// Переключение режимов разбавления (Классика / Конечный объем)
function toggleDilutionMode() {
    const mode = document.getElementById('dil-mode').value;
    
    if (mode === 'classic') {
        document.getElementById('group-dil-classic').style.display = 'block';
        document.getElementById('group-dil-target').style.display = 'none';
        document.getElementById('row-dil-source').style.display = 'none';
    } else {
        document.getElementById('group-dil-classic').style.display = 'none';
        document.getElementById('group-dil-target').style.display = 'block';
        document.getElementById('row-dil-source').style.display = 'flex';
    }
    // Скрываем старые результаты, так как режим изменился
    document.getElementById('res-dilution').style.display = 'none';
}

// Автоматический пересчет значений в инпутах при смене Л / МЛ
function convertDilutionInputs() {
    const unit = document.getElementById('dil-unit').value;
    if (unit === currentDilUnit) return;

    const volInput = document.getElementById('dil-vol');
    const targetVolInput = document.getElementById('dil-target-vol');

    const valVol = parseFloat(volInput.value) || 0;
    const valTargetVol = parseFloat(targetVolInput.value) || 0;

    if (unit === 'ml' && currentDilUnit === 'l') {
        volInput.value = (valVol * 1000).toFixed(0);
        targetVolInput.value = (valTargetVol * 1000).toFixed(0);
        document.getElementById('lbl-dil-vol').innerText = "Объем исходного спирта (мл)";
        document.getElementById('lbl-dil-target-vol').innerText = "Желаемый объем готового раствора (мл)";
    } else if (unit === 'l' && currentDilUnit === 'ml') {
        volInput.value = (valVol / 1000).toFixed(3);
        targetVolInput.value = (valTargetVol / 1000).toFixed(3);
        document.getElementById('lbl-dil-vol').innerText = "Объем исходного спирта (л)";
        document.getElementById('lbl-dil-target-vol').innerText = "Желаемый объем готового раствора (л)";
    }
    
    currentDilUnit = unit;

    // Если результаты уже были выведены на экран, сразу обновляем их в новых единицах
    if (document.getElementById('res-dilution').style.display === 'block') {
        runDilution();
    }
}

// Обновленный расчет разбавления с учетом температуры
function runDilution() {
    const mode = document.getElementById('dil-mode').value;
    const unit = document.getElementById('dil-unit').value;
    
    const inputStrength = parseFloat(document.getElementById('dil-strength').value) || 0;
    const inputTemp = parseFloat(document.getElementById('dil-temp').value) || 20;
    const target = parseFloat(document.getElementById('dil-target').value) || 0;
    
    // 1. Считаем истинную крепость через модуль коррекции
    const strength = OIML.getTrueStrength(inputStrength, inputTemp);
    
    // 2. Если температура не 20, показываем пользователю реальную крепость
    const rowTrueStr = document.getElementById('row-dil-true-str');
    if (inputTemp !== 20) {
        document.getElementById('val-dil-true-str').innerText = displayRound(strength, 2) + " % об.";
        rowTrueStr.style.display = 'flex';
    } else {
        rowTrueStr.style.display = 'none';
    }

    if (target >= strength) {
        alert("Целевая крепость должна быть меньше исходной (с учетом температурной коррекции)!");
        return;
    }

    // Настраиваем множители отображения и знаки
    const multiplier = unit === 'ml' ? 1000 : 1;
    const unitSign = unit === 'ml' ? " мл" : " л";
    const decimals = unit === 'ml' ? 1 : 3;

    let res;

    if (mode === 'classic') {
        let vol = parseFloat(document.getElementById('dil-vol').value) || 0;
        if (unit === 'ml') vol /= 1000; 
        
        res = OIML.dilution(vol, strength, target);
    } else {
        let targetVol = parseFloat(document.getElementById('dil-target-vol').value) || 0;
        if (unit === 'ml') targetVol /= 1000;
        
        res = OIML.dilutionTargetVolume(targetVol, strength, target);
        
        // Показываем сколько нужно взять исходного спирта
        document.getElementById('val-dil-source').innerText = displayRound(res.sourceVolume * multiplier, decimals) + unitSign;
    }
    
    // Выводим остальные результаты
    document.getElementById('val-dil-as').innerText = displayRound(res.absoluteAlcohol * multiplier, decimals) + unitSign;
    document.getElementById('val-dil-water').innerText = displayRound(res.waterToAdd * multiplier, decimals) + unitSign;
    document.getElementById('val-dil-final').innerText = displayRound(res.finalVolume * multiplier, decimals) + unitSign;
    
    // Выводим контракцию
    const contraMl = res.contractionVolume * 1000;
    document.getElementById('val-dil-contra').innerText = displayRound(contraMl, 1) + " мл (" + displayRound(res.contractionPercent, 2) + "%)";
    
    document.getElementById('res-dilution').style.display = 'block';
}

// 3. Запуск расчета фракций
// Храним текущую единицу измерения для дробного перегона
let currentFracUnit = 'l';

// Конвертация инпута дробного перегона при смене Л / МЛ
function convertFractionInputs() {
    const unit = document.getElementById('frac-unit').value;
    if (unit === currentFracUnit) return;

    const volInput = document.getElementById('frac-vol');
    const valVol = parseFloat(volInput.value) || 0;

    if (unit === 'ml' && currentFracUnit === 'l') {
        volInput.value = (valVol * 1000).toFixed(0);
        document.getElementById('lbl-frac-vol').innerText = "Объем спирта-сырца (мл)";
    } else if (unit === 'l' && currentFracUnit === 'ml') {
        volInput.value = (valVol / 1000).toFixed(3);
        document.getElementById('lbl-frac-vol').innerText = "Объем спирта-сырца (л)";
    }
    
    currentFracUnit = unit;

    // Если результаты открыты — пересчитываем "на лету"
    if (document.getElementById('res-fraction').style.display === 'block') {
        runFraction();
    }
}

// Модернизированный запуск расчета фракций
function runFraction() {
    const unit = document.getElementById('frac-unit').value;
    let vol = parseFloat(document.getElementById('frac-vol').value) || 0;
    
    // Если введено в мл, переводим в литры для расчетного ядра
    if (unit === 'ml') vol /= 1000;
    
    const strength = parseFloat(document.getElementById('frac-strength').value) || 0;
    const qOutput = parseFloat(document.getElementById('frac-q-output').value) || 0;
    const headsP = parseFloat(document.getElementById('frac-heads').value) || 0;
    const tailsP = parseFloat(document.getElementById('frac-tails').value) || 0;
    
    if (qOutput <= 0 || qOutput > 100) {
        alert("Крепость продукта на выходе должна быть в диапазоне от 1 до 100% об.!");
        return;
    }
    
    const res = OIML.fraction(vol, strength, headsP, tailsP, qOutput);
    
    // Множители для красивого вывода в зависимости от выбранных л/мл
    const multiplier = unit === 'ml' ? 1000 : 1;
    const unitSign = unit === 'ml' ? " мл" : " л";
    const decimals = unit === 'ml' ? 1 : 3;
    
    document.getElementById('val-frac-as').innerText = displayRound(res.totalAlcohol * multiplier, decimals) + unitSign + " АС";
    document.getElementById('val-frac-heads').innerText = displayRound(res.heads * multiplier, decimals) + unitSign;
    document.getElementById('val-frac-hearts-as').innerText = displayRound(res.hearts * multiplier, decimals) + unitSign + " АС";
    
    // Выводим физический объем тела при заданной крепости
    document.getElementById('val-frac-hearts-vol').innerText = displayRound(res.heartsVolume * multiplier, decimals) + unitSign;
    
    document.getElementById('val-frac-tails').innerText = displayRound(res.tails * multiplier, decimals) + unitSign;
    
    document.getElementById('res-fraction').style.display = 'block';
}

// ==========================================
// 4. Логика для вкладки Смешивание
// ==========================================
let currentBlendUnit = 'l';

function setBlendUnit(unit) {
    document.getElementById('btn-blend-l').classList.remove('active');
    document.getElementById('btn-blend-ml').classList.remove('active');
    document.getElementById('btn-blend-' + unit).classList.add('active');
    
    document.getElementById('blend-unit').value = unit;
    convertBlendInputs();
}

function convertBlendInputs() {
    const unit = document.getElementById('blend-unit').value;
    if (unit === currentBlendUnit) return;

    const vol1Input = document.getElementById('blend-vol1');
    const vol2Input = document.getElementById('blend-vol2');
    const valVol1 = parseFloat(vol1Input.value) || 0;
    const valVol2 = parseFloat(vol2Input.value) || 0;

    if (unit === 'ml' && currentBlendUnit === 'l') {
        vol1Input.value = (valVol1 * 1000).toFixed(0);
        vol2Input.value = (valVol2 * 1000).toFixed(0);
        document.getElementById('lbl-blend-vol1').innerText = "Объем первого раствора (мл)";
        document.getElementById('lbl-blend-vol2').innerText = "Объем второго раствора (мл)";
    } else if (unit === 'l' && currentBlendUnit === 'ml') {
        vol1Input.value = (valVol1 / 1000).toFixed(3);
        vol2Input.value = (valVol2 / 1000).toFixed(3);
        document.getElementById('lbl-blend-vol1').innerText = "Объем первого раствора (л)";
        document.getElementById('lbl-blend-vol2').innerText = "Объем второго раствора (л)";
    }
    
    currentBlendUnit = unit;

    if (document.getElementById('res-blend').style.display === 'block') {
        runBlend();
    }
}

function runBlend() {
    const unit = document.getElementById('blend-unit').value;
    
    let v1 = parseFloat(document.getElementById('blend-vol1').value) || 0;
    let v2 = parseFloat(document.getElementById('blend-vol2').value) || 0;
    const q1 = parseFloat(document.getElementById('blend-str1').value) || 0;
    const q2 = parseFloat(document.getElementById('blend-str2').value) || 0;

    // Ядро OIML работает только с литрами
    if (unit === 'ml') {
        v1 /= 1000;
        v2 /= 1000;
    }

    // Обращаемся к модулю 3
    const res = OIML.blend(v1, q1, v2, q2);

    // Настраиваем вывод
    const multiplier = unit === 'ml' ? 1000 : 1;
    const unitSign = unit === 'ml' ? " мл" : " л";
    const decimals = unit === 'ml' ? 1 : 3;

    document.getElementById('val-blend-str').innerText = displayRound(res.strength, 2) + " % об.";
    document.getElementById('val-blend-vol').innerText = displayRound(res.volume * multiplier, decimals) + unitSign;
    
    // Контракцию выводим в миллилитрах для наглядности
    const contraMl = res.contraction * 1000;
    document.getElementById('val-blend-contra').innerText = displayRound(contraMl, 1) + " мл";

    document.getElementById('res-blend').style.display = 'block';
}