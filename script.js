
const tooltip = document.getElementById('tooltip');
let hideTooltipTimeout; // Для задержки скрытия
let tooltipHovered = false; // Для отслеживания наведения на саму подсказку

// Глобальные переменные для управления картой
let scale = 1;
let currentX = 0;
let currentY = 0;

const scaleStep = 0.1;
const minScale = 0.1;
const maxScale = 10; // Увеличено максимальное масштабирование

document.querySelectorAll('.region').forEach(region => {
    region.classList.remove('disabled');
    region.addEventListener('mouseenter', function(e) {
        clearTimeout(hideTooltipTimeout); // Отменяем предыдущий таймер
        tooltip.textContent = this.dataset.name;
        tooltip.style.left = `${e.pageX + 15}px`; // Новое смещение
        tooltip.style.top = `${e.pageY + 15}px`;  // Новое смещение
        tooltip.style.opacity = '1';
    });

    region.addEventListener('mousemove', function(e) {
        tooltip.style.left = `${e.pageX + 0}px`;
        tooltip.style.top = `${e.pageY + -100}px`;
    });

    region.addEventListener('mouseleave', function() {
        hideTooltipTimeout = setTimeout(() => {
            if (!tooltipHovered) {
                tooltip.style.opacity = '0';
            }
        }, 80); // 8 секунд
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const regions = document.querySelectorAll('.region');
    const progressModal = document.getElementById('progress-modal');
    const infoModal = document.getElementById('info-modal');
    const layersModal = document.getElementById('layers-modal');
    const progressBtn = document.getElementById('progress-btn');
    const infoBtn = document.getElementById('info-btn');
    const layersBtn = document.getElementById('layers-btn');
    const markBtn = document.getElementById('mark-btn');
    const closeButtons = document.querySelectorAll('.close-btn');
    const progressPercent = document.getElementById('progress-percent');
    const progressFill = document.getElementById('progress-fill');
    const mapTooltip = document.getElementById('map-tooltip'); // Renamed to avoid conflict with global tooltip
    const layerBtns = document.querySelectorAll('.layer-btn');
    const regionLayer = document.getElementById('regions-layer');
    const reserveLayer = document.getElementById('reserves-layer');
    let currentLayer = 'regions'; // по умолчанию
    const attractionsLayer = document.getElementById('attractions-layer'); // New: Достопримечательности слой
    let visitedAttractions = JSON.parse(localStorage.getItem('visitedAttractions') || '[]'); 
    let visitedReserves = JSON.parse(localStorage.getItem('visitedReserves') || '[]');

    // NEW: Элементы панели подтверждения
    const confirmationPanel = document.getElementById('confirmation-panel');
    const confirmationText = document.getElementById('confirmation-text');
    const confirmMarkBtn = document.getElementById('confirm-mark-btn');

    // Ультимативный сброс всех отметок при загрузке страницы
    document.querySelectorAll('.region, .reserve, .attraction, .poi').forEach(element => {
        element.classList.remove('visited');
    });

    initReserves(); 
    initAttractions(); // NEW: Инициализация достопримечательностей при загрузке страницы


    // Хранилище посещенных регионов
    let visitedRegions = JSON.parse(localStorage.getItem('visitedRegions')) || [];
    
    // Инициализация карты
    function initMap() {
        regions.forEach(region => {
            const regionId = region.id;
            
            // Проверяем, посещен ли регион
            if (visitedRegions.includes(regionId)) {
                region.classList.add('visited');
            }
        });
        
        updateProgress();
    }
    

    function initReserves() {
        // Убраны локальные объявления tooltip и tooltipHovered, используем глобальные
        document.querySelectorAll('.reserve').forEach(reserve => {
            const id = reserve.id;
            const name = reserve.dataset.name;
            const url = reserve.dataset.url;

            // Отображаем подсказку
            reserve.addEventListener('mouseover', function(e) {
                clearTimeout(hideTooltipTimeout); // Отменяем предыдущий таймер
                tooltip.innerHTML = `<strong>${name}</strong>${url ? `<br><a href="${url}" target="_blank">` : ''}`;
                tooltip.style.left = `${e.pageX + 15}px`; // Новое смещение
                tooltip.style.top = `${e.pageY + 15}px`;  // Новое смещение
                tooltip.style.opacity = '1';
            });

            reserve.addEventListener('mousemove', function(e) { // Оставить, если нужно более точное следование за курсором
                tooltip.style.left = `${e.pageX + 0}px`;
                tooltip.style.top = `${e.pageY + -100}px`;
            });

            // Скрытие только если курсор не на tooltip
            reserve.addEventListener('mouseout', function() {
                hideTooltipTimeout = setTimeout(() => {
                    if (!tooltipHovered) {
                        tooltip.style.opacity = '0';
                    }
                }, 80); // 8 секунд
            });

            // Обработка наведения на сам tooltip
            tooltip.addEventListener('mouseenter', () => {
                clearTimeout(hideTooltipTimeout); // Отменяем таймер скрытия, если навели на саму подсказку
                tooltipHovered = true;
            });
            tooltip.addEventListener('mouseleave', () => {
                tooltipHovered = false;
                hideTooltipTimeout = setTimeout(() => { // Устанавливаем таймер скрытия, если убрали курсор с подсказки
                    tooltip.style.opacity = '0';
                }, 200); // Короткая задержка, чтобы пользователь мог уйти с подсказки
            });


            // При загрузке
            if (visitedReserves.includes(id)) {
                reserve.classList.add('visited');
            }
        });
    }

    function initAttractions() {
        document.querySelectorAll('.attraction, .poi').forEach(attraction => {
            const id = attraction.id;
            if (visitedAttractions.includes(id)) {
                attraction.classList.add('visited');
            }
        });
    }


    // Обновление прогресса
    function updateProgress() {
        // Calculate progress based on regions only
        const percent = getVisitedRegionsPercentage();
        
        const progressPercent = document.getElementById('progress-percent');
        const progressFill = document.getElementById('progress-fill');
        
        progressPercent.textContent = percent;
        progressFill.style.width = `${percent}%`;
    }

    
    // NEW: Функция для плавного перемещения и масштабирования к элементу
    function flyToElement(element, duration = 800) {
        if (!element) return;

        let elementCenterX, elementCenterY;
        let elementWidth, elementHeight;

        // Для элементов <circle> используем cx и cy
        if (element.tagName === 'circle') {
            elementCenterX = parseFloat(element.getAttribute('cx'));
            elementCenterY = parseFloat(element.getAttribute('cy'));
            elementWidth = parseFloat(element.getAttribute('r')) * 2; // Диаметр круга
            elementHeight = elementWidth;
        } else { // Для <path> и других элементов используем getBBox()
            const bbox = element.getBBox();
            elementCenterX = bbox.x + bbox.width / 2;
            elementCenterY = bbox.y + bbox.height / 2;
            elementWidth = bbox.width;
            elementHeight = bbox.height;
        }

        const svgRect = svg.getBoundingClientRect(); // Получаем размеры SVG элемента на экране
        const svgWidth = svgRect.width;
        const svgHeight = svgRect.height;

        // Вычисляем оптимальный масштаб, чтобы элемент занимал примерно 50% ширины/высоты экрана
        const paddingFactor = 1.5; // Отступ вокруг элемента
        const scaleX = svgWidth / (elementWidth * paddingFactor);
        const scaleY = svgHeight / (elementHeight * paddingFactor);
        const targetScale = Math.max(minScale, Math.min(maxScale, Math.min(scaleX, scaleY)));

        // Вычисляем целевые координаты смещения (translate)
        // Цель: перевести центр элемента в центр видимой области SVG, учитывая новый масштаб
        // Это сложнее, чем просто вычитать, нужно учитывать текущие преобразования SVG
        // Сначала переводим центр видимой области SVG в координаты SVG-пространства
        const screenCenter = svg.createSVGPoint();
        screenCenter.x = svgWidth / 2;
        screenCenter.y = svgHeight / 2;
        const svgCenter = screenCenter.matrixTransform(svg.getScreenCTM().inverse());

        // Затем рассчитываем смещение, необходимое для перемещения elementCenterX,Y к svgCenter
        const newTargetX = (svgCenter.x - elementCenterX) * targetScale;
        const newTargetY = (svgCenter.y - elementCenterY) * targetScale;

        // Получаем текущие значения
        const currentTransform = mapInner.transform.baseVal.consolidate();
        let startX = currentTransform ? currentTransform.matrix.e : 0;
        let startY = currentTransform ? currentTransform.matrix.f : 0;
        let startScale = currentTransform ? currentTransform.matrix.a : 1;

        let startTime = null;

        function animate(currentTime) {
            if (!startTime) startTime = currentTime;
            const progress = (currentTime - startTime) / duration;

            if (progress < 1) {
                const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2; // Ease-in-out

                currentX = startX + ((svgWidth / 2 - elementCenterX * targetScale) - startX) * easedProgress;
                currentY = startY + ((svgHeight / 2 - elementCenterY * targetScale) - startY) * easedProgress;
                scale = startScale + (targetScale - startScale) * easedProgress;

                mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
                requestAnimationFrame(animate);
            } else {
                currentX = (svgWidth / 2 - elementCenterX * targetScale);
                currentY = (svgHeight / 2 - elementCenterY * targetScale);
                scale = targetScale;
                mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
            }
        }
        requestAnimationFrame(animate);
    }
    
    // Обработчики кнопок
    progressBtn.addEventListener('click', function() {
        progressModal.style.display = 'flex';
    });
    
    infoBtn.addEventListener('click', function() {
        infoModal.style.display = 'flex';
    });
    
    layersBtn.addEventListener('click', function() {
        layersModal.style.display = 'flex';
    });
    
    markBtn.addEventListener('click', function() {
        this.classList.toggle('active');
    });
    
    // Закрытие модальных окон
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
    
    // Клик вне модального окна
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // NEW: Обработчик для кнопки подтверждения отметки
    confirmMarkBtn.addEventListener('click', function() {
        const targetId = confirmationPanel.dataset.targetId;
        const targetLayer = confirmationPanel.dataset.targetLayer;
        const tappedElement = document.getElementById(targetId);

        if (!tappedElement) return;

        let currentVisitedArray;
        let localStorageKey;

        if (targetLayer === 'regions') {
            currentVisitedArray = visitedRegions;
            localStorageKey = 'visitedRegions';
        } else if (targetLayer === 'reserves') {
            currentVisitedArray = visitedReserves;
            localStorageKey = 'visitedReserves';
        } else if (targetLayer === 'attractions') {
            currentVisitedArray = visitedAttractions;
            localStorageKey = 'visitedAttractions';
        } else {
            return; // Неизвестный слой
        }

        // Переключаем статус посещения
        if (tappedElement.classList.contains('visited')) {
            tappedElement.classList.remove('visited');
            currentVisitedArray = currentVisitedArray.filter(id => id !== targetId);
        } else {
            tappedElement.classList.add('visited');
            if (!currentVisitedArray.includes(targetId)) {
                currentVisitedArray.push(targetId);
            }
        }

        // Обновляем соответствующие массивы и localStorage
        if (targetLayer === 'regions') {
            visitedRegions = currentVisitedArray;
        } else if (targetLayer === 'reserves') {
            visitedReserves = currentVisitedArray;
        } else if (targetLayer === 'attractions') {
            visitedAttractions = currentVisitedArray;
        }

        localStorage.setItem(localStorageKey, JSON.stringify(currentVisitedArray));
        updateProgress();
        confirmationPanel.classList.remove('visible'); // Скрываем панель после отметки
    });
    
    // Переключение слоев
    layerBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const selected = this.dataset.layer;

            // Удаляем класс active у всех кнопок
            layerBtns.forEach(b => b.classList.remove('active'));

            // Добавляем класс active текущей кнопке
            this.classList.add('active');

            // Переключаем слой
            switchLayer(selected);

        }); 
    });

    // Добавляем обработчик для кнопки "Поделиться"
    const shareButton = document.getElementById('settings-btn'); // Changed ID to settings-btn
    if (shareButton) {
        shareButton.addEventListener('click', shareResults);
    }

    //переключение слоёв
    function switchLayer(layer) {
        currentLayer = layer;
        confirmationPanel.classList.remove('visible'); // Скрываем панель при переключении слоя

        // Универсальный сброс всех отметок перед применением новых
        document.querySelectorAll('.region, .reserve, .attraction, .poi').forEach(element => {
            element.classList.remove('visited');
        });

        if (layer === 'regions') {
            regionLayer.style.display = 'inline';
            reserveLayer.style.display = 'none';
            attractionsLayer.style.display = 'none'; // NEW: Скрываем слой достопримечательностей при переключении на регионы

            // Разблокировать регионы
            regions.forEach(r => {
                r.classList.remove('disabled');
                if (visitedRegions.includes(r.id)) {
                    r.classList.add('visited');
                }
            });

        } else if (layer === 'reserves') {
            regionLayer.style.display = 'inline'; // всё равно показываем регионы, но блокируем
            reserveLayer.style.display = 'inline';
            attractionsLayer.style.display = 'none'; // NEW: Скрываем слой достопримечательностей при переключении на заповедники

            // Сделать регионы серыми и недоступными
            regions.forEach(r => {
                r.classList.add('disabled');
            });
            
            // Отметить посещённые заповедники
            document.querySelectorAll('.reserve').forEach(reserve => {
                if (visitedReserves.includes(reserve.id)) {
                    reserve.classList.add('visited');
                } else {
                    reserve.classList.remove('visited');
                }
            });

        } else if (layer === 'attractions') { // NEW BLOCK FOR ATTRACTIONS
            regionLayer.style.display = 'inline'; // всё равно показываем регионы, но блокируем
            reserveLayer.style.display = 'none'; // Скрываем слой заповедников
            attractionsLayer.style.display = 'inline';
            // Показываем слой с достопримечательностями
            regions.forEach(r => r.classList.add('disabled'));

            // Отметить посещённые достопримечательности (пока пусто, будет реализовано позже)
            document.querySelectorAll('.attraction, .poi').forEach(attraction => {
                if (visitedAttractions.includes(attraction.id)) {
                    attraction.classList.add('visited');
                } else {
                    attraction.classList.remove('visited');
                }
            });
        }
    }

    // NEW: Функция для получения процента посещенных регионов
    function getVisitedRegionsPercentage() {
        const totalRegions = regions.length;
        const visitedCount = visitedRegions.length;
        if (totalRegions === 0) return 0;
        return ((visitedCount / totalRegions) * 100).toFixed(0);
    }

    // NEW: Функция для получения процента посещенных заповедников
    function getVisitedReservesPercentage() {
        const totalReserves = document.querySelectorAll('.reserve').length;
        const visitedCount = visitedReserves.length;
        if (totalReserves === 0) return 0;
        return ((visitedCount / totalReserves) * 100).toFixed(0);
    }

    // NEW: Функция для получения процента посещенных достопримечательностей
    function getVisitedAttractionsPercentage() {
        const totalAttractions = document.querySelectorAll('.attraction, .poi').length;
        const visitedCount = visitedAttractions.length;
        if (totalAttractions === 0) return 0;
        return ((visitedCount / totalAttractions) * 100).toFixed(0);
    }

    // NEW: Функция для генерации изображения карты
    async function generateMapImage() {
        const mapContainer = document.querySelector('.map-container'); // Или любой другой элемент, содержащий SVG
        
        // Убедимся, что domtoimage загружен
        if (typeof domtoimage === 'undefined') {
            console.error('dom-to-image library is not loaded.');
            return null;
        }

        try {
            // Клонируем SVG, чтобы применить временные стили без изменения DOM
            const originalSvg = document.querySelector('svg');
            const clonedSvg = originalSvg.cloneNode(true);

            // Use explicit width/height attributes from originalSvg if available, otherwise fallback to client dimensions.
            let svgWidth = parseFloat(originalSvg.getAttribute('width'));
            let svgHeight = parseFloat(originalSvg.getAttribute('height'));

            // If width/height attributes are not explicitly set, try to use viewBox dimensions.
            const viewBoxAttr = originalSvg.getAttribute('viewBox');
            if (viewBoxAttr) {
                const viewBox = viewBoxAttr.split(' ').map(Number);
                if (isNaN(svgWidth) && viewBox[2]) {
                    svgWidth = viewBox[2];
                }
                if (isNaN(svgHeight) && viewBox[3]) {
                    svgHeight = viewBox[3];
                }
                clonedSvg.setAttribute('viewBox', viewBoxAttr);
            }

            // Fallback to client dimensions if neither explicit attributes nor viewBox provide dimensions.
            if (isNaN(svgWidth)) {
                svgWidth = originalSvg.clientWidth;
            }
            if (isNaN(svgHeight)) {
                svgHeight = originalSvg.clientHeight;
            }

            // svgWidth = Math.max(100, svgWidth - 350); // This line was commented out previously

            clonedSvg.setAttribute('width', svgWidth);
            clonedSvg.setAttribute('height', svgHeight);

            // Create a background rectangle and prepend it to the cloned SVG
            const backgroundRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            backgroundRect.setAttribute('width', svgWidth);
            backgroundRect.setAttribute('height', svgHeight);
            backgroundRect.setAttribute('fill', 'white');
            clonedSvg.prepend(backgroundRect);

            // NEW: Копируем вычисленные стили для регионов, заповедников и достопримечательностей
            const elementsToStyle = ['.region', '.reserve', '.attraction', '.poi'];
            elementsToStyle.forEach(selector => {
                originalSvg.querySelectorAll(selector).forEach(originalElement => {
                    const clonedElement = clonedSvg.querySelector(`#${originalElement.id}`);
                    if (clonedElement) {
                        const computedStyle = getComputedStyle(originalElement);
                        // Копируем только основные SVG-свойства
                        clonedElement.style.fill = computedStyle.fill;
                        clonedElement.style.stroke = computedStyle.stroke;
                        clonedElement.style.strokeWidth = computedStyle.strokeWidth;
                        clonedElement.style.transition = 'none'; // Отключаем переходы для статического изображения
                    }
                });
            });

            // Копируем стили для посещенных элементов
            const visitedElements = originalSvg.querySelectorAll('.visited');
            visitedElements.forEach(originalElement => {
                const clonedElement = clonedSvg.querySelector(`#${originalElement.id}`);
                if (clonedElement) {
                    clonedElement.classList.add('visited'); // Добавляем класс, чтобы применились встроенные стили (если есть)
                    // Также можно скопировать вычисленные стили для .visited классов
                    const computedStyle = getComputedStyle(originalElement);
                    clonedElement.style.fill = computedStyle.fill;
                    clonedElement.style.stroke = computedStyle.stroke;
                }
            });

            // Ensure mapInner is defined and accessible (it's a global variable)
            const mapInnerClone = clonedSvg.querySelector('#map-inner');
            if (mapInnerClone) {
                // Use the global scale, currentX, currentY from the live map state
                mapInnerClone.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
            }

            console.log('originalSvg outerHTML:', originalSvg.outerHTML);
            console.log('clonedSvg outerHTML before domtoimage:', clonedSvg.outerHTML);
            console.log('clonedSvg width:', clonedSvg.getAttribute('width'));
            console.log('clonedSvg height:', clonedSvg.getAttribute('height'));
            if (mapInnerClone) {
                console.log('mapInnerClone transform:', mapInnerClone.getAttribute('transform'));
            }

            const dataUrl = await domtoimage.toPng(clonedSvg, {
                width: svgWidth,
                height: svgHeight,
            });

            return dataUrl;
        } catch (error) {
            console.error('Ошибка при генерации изображения карты:', error);
            return null;
        }
    }

    // Функция для обработки кнопки "Поделиться"
    async function shareResults() {
        const regionPercentage = getVisitedRegionsPercentage();
        const visitedRegionsCount = visitedRegions.length;
        const totalRegionsCount = regions.length;
        let shareText = 'Мои достижения на карте России:\n';
        shareText += `Вы посетили регионов - ${visitedRegionsCount}. Это ${regionPercentage}% от всей страны!\n`;
        if (regionPercentage > 0) {
            shareText += `- Регионы: ${regionPercentage}%\n`;
        }

        const reservePercentage = getVisitedReservesPercentage();
        if (reservePercentage > 0) {
            shareText += `- Заповедники: ${reservePercentage}%\n`;
        }

        const attractionPercentage = getVisitedAttractionsPercentage();
        if (attractionPercentage > 0) {
            shareText += `- Достопримечательности: ${attractionPercentage}%\n`;
        }

        shareText += `Присоединяйтесь и исследуйте!\n`; // Removed the URL from here
        shareText += `Наш телеграм канал:\nhttps://t.me/BeenInRussia\n`;
        shareText += `Отметить свои достижения:\nhttp://beeninrussia.ru/`; // Removed the URL from here

        const mapImage = await generateMapImage(); // Генерируем изображение карты

        if (navigator.share) {
            try {
                const shareData = {
                    title: 'Мои путешествия по России',
                    text: shareText,
                    files: mapImage ? [new File([await fetch(mapImage).then(res => res.blob())], 'map.png', { type: 'image/png' })] : []
                };
                console.log('Sharing data:', shareData);
                await navigator.share(shareData);
            } catch (error) {
                console.error('Error sharing:', error);
                alert('Чтобы поделиться, скопируйте текст: ' + shareText);
            }
        } else {
            alert('Чтобы поделиться, скопируйте текст: ' + shareText);
        }
    }


    // Инициализация приложения
    initMap();

    
// Перемещение карты мышью (правой кнопкой)
const svg = document.querySelector('svg');
const mapInner = document.getElementById('map-inner');

let isPanning = false;
let startX = 0;
let startY = 0;
// currentX и currentY теперь глобальные

svg.addEventListener('mousedown', function (e) {
    if (e.button === 2) { // Правая кнопка мыши
        isPanning = true;
        startX = e.clientX - currentX; // Сохраняем начальную позицию курсора относительно текущего смещения карты
        startY = e.clientY - currentY; // Сохраняем начальную позицию курсора относительно текущего смещения карты
        svg.style.cursor = 'grabbing';
        e.preventDefault();
    }
});

svg.addEventListener('mousemove', function (e) {
    if (!isPanning) return;

    // Вычисляем новое смещение, основываясь на начальной позиции и текущем положении курсора
    currentX = (e.clientX - startX);
    currentY = (e.clientY - startY);

    mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
});

svg.addEventListener('mouseup', function (e) {
    if (e.button === 2 && isPanning) {
        // currentX и currentY уже обновлены в mousemove
        isPanning = false;
        svg.style.cursor = 'default';
    }
});

svg.addEventListener('mouseleave', function () {
    if (isPanning) {
        // Если мышь уходит за пределы SVG во время перетаскивания, останавливаем перетаскивание
        isPanning = false;
        svg.style.cursor = 'default';
    }
});

// --- Обработчики для сенсорных событий (для мобильных устройств) ---
let isTouching = false;
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentX = 0; // Текущее смещение по X для тача
let touchCurrentY = 0; // Текущее смещение по Y для тача
let isPinching = false;
let initialDistance = 0;
let initialScale = 1;

// Добавляем переменные для отслеживания движения пальца и имитации клика
let lastTouchX = 0;
let lastTouchY = 0;
let hasMoved = false; // Флаг, указывающий на то, было ли значительное движение пальца
let initialTouchTarget = null; // Элемент, который был первым касанием
let tapTimer = null; // Таймер для определения долгого нажатия/клика
let isTapCandidate = false; // Флаг, указывающий, что текущее касание может быть тапом

const moveThreshold = 15; // Увеличиваем порог для определения движения

svg.addEventListener('touchstart', function (e) {
    hasMoved = false; // Сброс флага движения при новом касании
    if (e.touches.length === 1) { // Только один палец для панорамирования
        isTouching = true;
        touchStartX = e.touches[0].clientX - currentX; // Сохраняем начальную позицию касания относительно текущего смещения карты
        touchStartY = e.touches[0].clientY - currentY; // Сохраняем начальную позицию касания относительно текущего смещения карты
        lastTouchX = e.touches[0].clientX; // Сохраняем для определения движения
        lastTouchY = e.touches[0].clientY; // Сохраняем для определения движения
        // Проверяем, является ли целевой элемент кликабельным для потенциального тапа
        initialTouchTarget = e.target.closest('.region, .reserve, .attraction, .poi');
        if (initialTouchTarget) {
            isTapCandidate = true;
            tapTimer = setTimeout(() => {
                isTapCandidate = false; // Если таймер сработал, это не короткий тап
            }, 100); // 100 мс для определения клика
        } else {
            isTapCandidate = false;
        }
        e.preventDefault(); // NEW: Предотвращаем прокрутку страницы сразу для одиночного касания
    } else if (e.touches.length === 2) { // Два пальца для масштабирования (pinch-to-zoom)
        isPinching = true;
        isTouching = false; // Отключаем панорамирование одним пальцем

        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        initialDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        initialScale = scale;

        // Отладочное сообщение для touchstart (два пальца)
        // console.log('touchstart (2 fingers) - initialDistance:', initialDistance, 'initialScale:', initialScale);

        const screenMidpointX = (touch1.clientX + touch2.clientX) / 2;
        const screenMidpointY = (touch1.clientY + touch2.clientY) / 2;

        const svgPoint = svg.createSVGPoint();
        svgPoint.x = screenMidpointX;
        svgPoint.y = screenMidpointY;
        // const svgMidpoint = svgPoint.matrixTransform(svg.getScreenCTM().inverse()); // УДАЛЕНО

        // initialMidpointX = svgMidpoint.x; // УДАЛЕНО
        // initialMidpointY = svgMidpoint.y; // УДАЛЕНО

        e.preventDefault(); // Предотвращаем прокрутку страницы/масштабирование браузера
    }
});

svg.addEventListener('touchmove', function (e) {
    if (isTouching && e.touches.length === 1) {
        const currentTouchX = e.touches[0].clientX;
        const currentTouchY = e.touches[0].clientY;

        // Определяем, было ли значительное движение
        const deltaX = Math.abs(currentTouchX - lastTouchX);
        const deltaY = Math.abs(currentTouchY - lastTouchY);

        if (deltaX > moveThreshold || deltaY > moveThreshold) {
            hasMoved = true;
            if (tapTimer) {
                clearTimeout(tapTimer);
                tapTimer = null;
                isTapCandidate = false;
            }
            e.preventDefault();
        }

        lastTouchX = currentTouchX;
        lastTouchY = currentTouchY;

        if (hasMoved) {
            currentX = (e.touches[0].clientX - touchStartX);
            currentY = (e.touches[0].clientY - touchStartY);

            mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
            // touchCurrentX and touchCurrentY are no longer needed as currentX/currentY are updated directly
        }
    } else if (isPinching && e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];

        const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const scaleFactor = currentDistance / initialDistance;

        const newScale = Math.max(minScale, Math.min(maxScale, initialScale * scaleFactor));

        // Отладочное сообщение для touchmove (два пальца)
        // console.log('touchmove (2 fingers) - currentDistance:', currentDistance, 'scaleFactor:', scaleFactor, 'newScale:', newScale, 'current scale:', scale, 'newScale === scale:', newScale === scale);

        if (newScale === scale) return; // Если масштаб не изменился, нет смысла обновлять позицию

        const currentScreenMidpointX = (touch1.clientX + touch2.clientX) / 2;
        const currentScreenMidpointY = (touch1.clientY + touch2.clientY) / 2;

        // Вычисляем SVG-координаты точки, которая находится под текущим центром пальцев
        const currentSvgMidpointX = (currentScreenMidpointX - currentX) / scale;
        const currentSvgMidpointY = (currentScreenMidpointY - currentY) / scale;

        // Новое смещение, чтобы эта SVG-точка оставалась под текущим центром пальцев на экране
        currentX = currentScreenMidpointX - currentSvgMidpointX * newScale;
        currentY = currentScreenMidpointY - currentSvgMidpointY * newScale;

        scale = newScale;
        mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
        e.preventDefault();
    }
});

svg.addEventListener('touchend', function () {
    isTouching = false;
    if (isPinching) {
        isPinching = false;
        // currentX, currentY и scale уже были обновлены в touchmove
    }

    // Если это был тап (короткое касание без движения), инициируем логику отметки напрямую
    // console.log('touchend - hasMoved:', hasMoved, 'initialTouchTarget:', initialTouchTarget); // Отладочное сообщение
    // Изменяем условие для обработки тапа: теперь опираемся на isTapCandidate
    if (isTapCandidate && initialTouchTarget) {
        // console.log('touchend - Processing tap for:', initialTouchTarget.id);
        const tappedElement = initialTouchTarget;
        const id = tappedElement.id;

        let confirmationMessage = '';
        let buttonText = '';
        let isVisited = false;

        if (tappedElement.classList.contains('region')) {
            if (markBtn.classList.contains('active')) {
                isVisited = visitedRegions.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении региона ${tappedElement.dataset.name}?` : `Отметить регион ${tappedElement.dataset.name} как посещённый?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                // Если кнопка отметки не активна, просто показать информацию (или ничего не делать)
                // В данном случае, мы не показываем панель, если кнопка отметки не активна для регионов
                initialTouchTarget = null; // Сброс целевого элемента
                return;
            }
        } else if (tappedElement.classList.contains('reserve')) {
            if (currentLayer === 'reserves' && markBtn.classList.contains('active')) {
                isVisited = visitedReserves.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении заповедника ${tappedElement.dataset.name}?` : `Отметить заповедник ${tappedElement.dataset.name} как посещённый?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                initialTouchTarget = null; // Сброс целевого элемента
                return;
            }
        } else if (tappedElement.classList.contains('attraction') || tappedElement.classList.contains('poi')) {
            if (currentLayer === 'attractions' && markBtn.classList.contains('active')) {
                isVisited = visitedAttractions.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении достопримечательности ${tappedElement.dataset.name}?` : `Отметить достопримечательность ${tappedElement.dataset.name} как посещённую?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                initialTouchTarget = null; // Сброс целевого элемента
                return;
            }
        } else {
            initialTouchTarget = null; // Сброс целевого элемента, если не является отметкой
            return;
        }

        // Вызываем функцию flyToElement для центрирования карты на выбранном элементе
        flyToElement(tappedElement);

        // Показываем панель подтверждения
        confirmationText.textContent = confirmationMessage;
        confirmMarkBtn.textContent = buttonText;
        confirmationPanel.classList.add('visible');

        // Сохраняем ссылку на элемент для использования в обработчике кнопки подтверждения
        confirmationPanel.dataset.targetId = id;
        confirmationPanel.dataset.targetLayer = currentLayer;

    } else {
        confirmationPanel.classList.remove('visible'); // Скрываем панель, если это не тап
    }
    initialTouchTarget = null; // Сброс целевого элемента
});

// --- Подсказки для достопримечательностей (attraction) ---
// делегирование подсказок и кликов для poi / reserve / attraction
(function setupPoiDelegation() {
    const svg = document.querySelector('svg');
    const tooltip = document.getElementById('tooltip');
    if (!svg || !tooltip) {
        console.warn('SVG или tooltip не найден. svg=', svg, 'tooltip=', tooltip);
        return;
    }

    let hideTimer = null;

    // helper: показать тултип
    function showTip(e, el) {
        clearTimeout(hideTimer);
        const name = el.dataset.name || '';
        const url  = el.dataset.url  || '';
        tooltip.innerHTML = `<strong>${name}</strong>${url ? `<br><a href="${url}" target="_blank">` : ''}`;
        tooltip.style.left  = `${e.pageX + 12}px`;
        tooltip.style.top   = `${e.pageY + 12}px`;
        tooltip.style.opacity = '1';
    }

    // mouseover / mousemove / mouseout делегируем с capture=false
    svg.addEventListener('mouseover', (e) => {
        const el = e.target.closest && e.target.closest('.poi, .attraction');
        if (!el) return;
        showTip(e, el);
    });

    svg.addEventListener('mousemove', (e) => {
        const el = e.target.closest && e.target.closest('.poi, .attraction');
        if (!el) return;
        // обновляем позицию тултипа
        tooltip.style.left = `${e.pageX + -10}px`;
        tooltip.style.top  = `${e.pageY + -130}px`;
    });

    svg.addEventListener('mouseout', (e) => {
        // если ушли с элемента — прячем с небольшой задержкой
        const el = e.target.closest && e.target.closest('.poi, .attraction');
        if (!el) return;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => tooltip.style.opacity = '0', 150);
    });
})();

    // Отключение контекстного меню
    svg.addEventListener('contextmenu', function (e) {
        e.preventDefault();
    });

    svg.addEventListener('click', function (e) {
        const tappedElement = e.target.closest('.region, .reserve, .attraction, .poi');

        if (!tappedElement) return;

        const id = tappedElement.id;
        let confirmationMessage = '';
        let buttonText = '';
        let isVisited = false;

        if (tappedElement.classList.contains('region')) {
            if (markBtn.classList.contains('active')) {
                isVisited = visitedRegions.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении региона ${tappedElement.dataset.name}?` : `Отметить регион ${tappedElement.dataset.name} как посещённый?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                return;
            }
        } else if (tappedElement.classList.contains('reserve')) {
            if (currentLayer === 'reserves' && markBtn.classList.contains('active')) {
                isVisited = visitedReserves.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении заповедника ${tappedElement.dataset.name}?` : `Отметить заповедник ${tappedElement.dataset.name} как посещённый?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                return;
            }
        } else if (tappedElement.classList.contains('attraction') || tappedElement.classList.contains('poi')) {
            if (currentLayer === 'attractions' && markBtn.classList.contains('active')) {
                isVisited = visitedAttractions.includes(id);
                confirmationMessage = isVisited ? `Убрать отметку о посещении достопримечательности ${tappedElement.dataset.name}?` : `Отметить достопримечательность ${tappedElement.dataset.name} как посещённую?`;
                buttonText = isVisited ? 'Убрать' : 'Добавить';
            } else {
                return;
            }
        } else {
            return;
        }

        flyToElement(tappedElement);
        confirmationText.textContent = confirmationMessage;
        confirmMarkBtn.textContent = buttonText;
        confirmationPanel.classList.add('visible');
        confirmationPanel.dataset.targetId = id;
        confirmationPanel.dataset.targetLayer = currentLayer;
    });

    svg.addEventListener('wheel', function (e) {
        e.preventDefault();

        const delta = Math.sign(e.deltaY);
        const zoomFactor = delta > 0 ? (1 - scaleStep) : (1 + scaleStep);

        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        const newScale = Math.max(minScale, Math.min(maxScale, scale * zoomFactor));
        if (newScale === scale) return;

        currentX -= (svgP.x - currentX) * (newScale / scale - 1);
        currentY -= (svgP.y - currentY) * (newScale / scale - 1);

        scale = newScale;

        mapInner.setAttribute('transform', `translate(${currentX}, ${currentY}) scale(${scale})`);
    });
});


