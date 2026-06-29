"use strict";

/* ===========================================================
   Алкоголеметрическое расчетное ядро OIML R 22 (Стандарт ГОСТ)
   Полная автоматическая реализация с эталонной точностью
=========================================================== */
const OIML = (() => {

    // Полиномиальные коэффициенты группы А (от 1 до 12, для плотности при 20 °C)
    const A = [
        998.2012300,
        -192.9769495,
        389.1238958,
        -1668.103923,
        13522.15441,
        -88292.78388,
        306287.4042,
        -613838.1234,
        747017.2998,
        -547846.1354,
        223446.0334,
        -39032.85426
    ];

    // Полиномиальные коэффициенты группы В (от 1 до 6, температурные коррекции)
    const B = [
        -2.0618513e-1,
        -5.2682542e-3,
        3.6130013e-5,
        -3.8957702e-7,
        7.1693540e-9,
        -9.9739231e-11
    ];

    // Двумерная матрица коэффициентов группы C (строки i от 1 до 11, колонки k от 1 до 5)
    // ВНИМАНИЕ: Степени и знаки полностью восстановлены по стандарту OIML
    const C = [
        // i=1
        [ 1.693443461530087e-1, -1.193013005057e-2, -6.802995733503803e-4, 4.075376675622027e-6, -2.788074354782409e-8 ],
        // i=2
        [ -1.046914743455169e1,  2.517399633803461e-1,  1.876837790289664e-2, -8.763058573471110e-6,  1.345612883493354e-8 ],
        // i=3
        [  7.196353469546523e1, -2.170575700536993e0, -2.002561813734156e-1,  6.515031360099368e-6, 0 ],
        // i=4
        [ -7.047478054272792e2,  1.353034988843029e1,  1.022992966719220e0, -1.515784836987210e-6, 0 ],
        // i=5
        [  3.924090430035045e3, -5.029988758547014e1, -2.895696483903638e0, 0, 0 ],
        // i=6
        [ -1.210164659068747e4,  1.096355666577570e2,  4.810060584300675e0, 0, 0 ],
        // i=7
        [  2.248646550400788e4, -1.422753946421155e2, -4.672147440794683e0, 0, 0 ],
        // i=8
        [ -2.605562982188164e4,  1.080435942856230e2,  2.458043105903461e0, 0, 0 ],
        // i=9
        [  1.852373922069467e4, -4.414153236817392e1, -5.411227621436812e-1, 0, 0 ],
        // i=10
        [ -7.420201433430137e3,  7.442971530188783e0, 0, 0, 0 ],
        // i=11
        [  1.285617841998974e3, 0, 0, 0, 0 ]
    ];

    // Константные физические ориентиры плотности при 20 °C (кг/м³)
    const RHO_E20 = 789.2427563; // Абсолютный этанол
    const RHO_W20 = 998.2012300; // Чистая вода

    /**
     * Основной расчет плотности водно-спиртового раствора (кг/м³)
     * @param {number} p - массовая доля спирта (0.00 - 1.00)
     * @param {number} t - температура раствора (°C)
     */
    function getDensity(p, t) {
        if (p < 0) p = 0;
        if (p > 1) p = 1;
        const dT = t - 20.0;
        let rho = A[0];

        for (let k = 2; k <= 12; k++) {
            rho += A[k - 1] * Math.pow(p, k - 1);
        }
        for (let k = 1; k <= 6; k++) {
            rho += B[k - 1] * Math.pow(dT, k);
        }
        for (let i = 1; i <= 11; i++) {
            for (let k = 1; k <= 5; k++) {
                if (C[i - 1][k - 1] !== 0) {
                    rho += C[i - 1][k - 1] * Math.pow(p, i) * Math.pow(dT, k);
                }
            }
        }
        return rho;
    }

    /**
     * Конвертация массовой доли (p) в объемную долю (q) при 20 °C
     */
    function massToVol(p) {
        if (p <= 0) return 0;
        if (p >= 1) return 1;
        return p * (getDensity(p, 20) / RHO_E20);
    }

    /**
     * Высокоточный перевод объемной доли (q) в массовую (p) методом бинарного поиска
     */
    function volToMass(q) {
        if (q <= 0) return 0;
        if (q >= 1) return 1;
        let low = 0, high = 1, p = 0.5;
        for (let iter = 0; iter < 45; iter++) {
            p = (low + high) / 2;
            const currentQ = massToVol(p);
            if (Math.abs(currentQ - q) < 1e-10) break;
            if (currentQ < q) low = p; else high = p;
        }
        return p;
    }

    /**
     * Модуль 1: Температурная коррекция показаний ареометра
     * @param {number} qApparent - измеряемая крепость по прибору (% об.)
     * @param {number} t - температура жидкости (°C)
     * @returns {number} Истинная крепость при 20 °C (% об.)
     */
    function getTrueStrength(qApparent, t) {
        if (t === 20) return qApparent;
        const pApparent = volToMass(qApparent / 100);
        const rhoTarget = getDensity(pApparent, 20);

        let low = 0, high = 1, pActual = 0.5;
        for (let iter = 0; iter < 45; iter++) {
            pActual = (low + high) / 2;
            const rhoCurrent = getDensity(pActual, t);
            if (Math.abs(rhoCurrent - rhoTarget) < 1e-8) break;
            if (rhoCurrent > rhoTarget) low = pActual; else high = pActual;
        }
        return massToVol(pActual) * 100;
    }

    /**
     * Модуль 2: Профессиональное разбавление спирта водой
     */
    function dilution(v1, q1, qTarget) {
        if (qTarget >= q1) {
            throw new Error("Целевая крепость должна быть меньше исходной.");
        }
        const p1 = volToMass(q1 / 100);
        const pTarget = volToMass(qTarget / 100);

        const m1 = v1 * (getDensity(p1, 20) / 1000); 
        const mE = m1 * p1; 

        const mFinal = mE / pTarget;
        const mWater = mFinal - m1;
        const vWater = mWater / (RHO_W20 / 1000); 

        const vFinalReal = mFinal / (getDensity(pTarget, 20) / 1000);
        const contraction = (v1 + vWater) - vFinalReal;

        return {
            absoluteAlcohol: (v1 * q1) / 100,
            waterToAdd: vWater,
            finalVolume: vFinalReal,
            contractionVolume: contraction,
            contractionPercent: (contraction / (v1 + vWater)) * 100
        };
    }
/**
     * Модуль 2.2: Разбавление спирта под заданный конечный объем раствора (Заданный объем)
     * @param {number} vTarget - желаемый объем готового раствора (л)
     * @param {number} q1 - крепость исходного спирта (% об.)
     * @param {number} qTarget - желаемая крепость (% об.)
     */
    function dilutionTargetVolume(vTarget, q1, qTarget) {
        if (qTarget >= q1) {
            throw new Error("Целевая крепость должна быть меньше исходной.");
        }
        const p1 = volToMass(q1 / 100);
        const pTarget = volToMass(qTarget / 100);

        // Получаем плотности в кг/л (или г/мл) при 20 °C
        const rho1 = getDensity(p1, 20) / 1000;
        const rhoTarget = getDensity(pTarget, 20) / 1000;

        // Общая масса целевого раствора
        const mFinal = vTarget * rhoTarget;
        // Масса чистого этанола в нем
        const mE = mFinal * pTarget; 

        // Сколько массы исходного спирта нужно взять для получения этой массы этанола
        const m1 = mE / p1;
        // Переводим массу исходного спирта в объем (л)
        const v1 = m1 / rho1;

        // Необходимая масса воды
        const mWater = mFinal - m1;
        const vWater = mWater / (RHO_W20 / 1000); 

        // Рассчитываем контракцию для вывода информации
        const contraction = (v1 + vWater) - vTarget;

        return {
            sourceVolume: v1,
            absoluteAlcohol: (v1 * q1) / 100,
            waterToAdd: vWater,
            finalVolume: vTarget,
            contractionVolume: contraction,
            contractionPercent: (contraction / (v1 + vWater)) * 100
        };
    }
    /**
     * Модуль 3: Смешивание двух растворов разной крепости
     */
    function blend(v1, q1, v2, q2) {
        const p1 = volToMass(q1 / 100);
        const p2 = volToMass(q2 / 100);

        const m1 = v1 * (getDensity(p1, 20) / 1000);
        const m2 = v2 * (getDensity(p2, 20) / 1000);

        const mTotal = m1 + m2;
        const pFinal = ((m1 * p1) + (m2 * p2)) / mTotal;

        return {
            volume: mTotal / (getDensity(pFinal, 20) / 1000),
            strength: massToVol(pFinal) * 100,
            contraction: (v1 + v2) - (mTotal / (getDensity(pFinal, 20) / 1000))
        };
    }

    /**
     * Модуль 4: Дробная перегонка с расчетом физического объема тела
     */
    function fraction(volume, strength, headPercent = 10, tailPercent = 15, qOutput = 70) {
        const alcohol = (volume * strength) / 100;
        const heads = (alcohol * headPercent) / 100;
        const tails = (alcohol * tailPercent) / 100;
        const hearts = alcohol - heads - tails;

        // Рассчитываем реальный физический объем тела при заданной выходной крепости
        const heartsVolume = qOutput > 0 ? (hearts / (qOutput / 100)) : hearts;

        return {
            totalAlcohol: alcohol,
            heads: heads,
            hearts: hearts, // АС в теле
            tails: tails,
            heartsVolume: heartsVolume // Реальный объем тела при заданной крепости
        };
    }

    // Экспортируем все функции наружу (ЭТОТ БЛОК БЫЛ ПОТЕРЯН)
    return {
        getTrueStrength,
        dilution,
        dilutionTargetVolume,
        blend,
        fraction
    };
})();