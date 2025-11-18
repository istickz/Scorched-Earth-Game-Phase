import Phaser from 'phaser';

/**
 * NES-style UI components and utilities
 * 
 * COORDINATE SYSTEM IN PHASER:
 * ============================
 * 
 * Phaser containers use a hierarchical coordinate system:
 * 
 * 1. **Root Level (Scene)**:
 *    - `scene.add.container(x, y)` creates container at ABSOLUTE coordinates on scene
 *    - Default origin is (0.5, 0.5) = center of container
 * 
 * 2. **Child Containers**:
 *    - When container is added to parent via `parent.add(child)`, 
 *      child's coordinates become RELATIVE to parent's center (0, 0)
 *    - Example: If parent is at (100, 200) and child is at (50, 30),
 *      child's world position = (150, 230)
 * 
 * 3. **Objects Inside Container**:
 *    - All objects added to container use RELATIVE coordinates to container center
 *    - Container center = (0, 0) in local coordinates
 *    - Example: To place object at top-left of container:
 *      x = -width/2, y = -height/2
 * 
 * BEST PRACTICES:
 * ==============
 * - Always use RELATIVE coordinates for objects inside containers
 * - Only root container uses ABSOLUTE coordinates on scene
 * - When creating nested containers, pass RELATIVE coordinates
 * - HTML elements (input, etc.) must use ABSOLUTE screen coordinates (browser limitation)
 */

// NES Color Palette
export const NESColors = {
  blue: 0x3498db,
  lightBlue: 0x5dade2,
  yellow: 0xf1c40f,
  white: 0xffffff,
  black: 0x000000,
  darkGray: 0x2c3e50,
  gray: 0x34495e,
} as const;

// NES Theme Configuration
export const NESTheme = {
  // Border & Radius
  borderRadius: 8,
  borderWidth: 2,
  borderWidthSelected: 3,
  innerBorderWidth: 1,
  
  // Spacing
  padding: 10,
  gap: 20,
  
  // Component-specific
  sliderTrackHeight: 6,
  sliderThumbRadius: 10,
  radioButtonRadius: 8,
  radioButtonSpacing: 100,
  radioLabelOffset: 15,
  
  // Text
  shadowOffset: 1,
  defaultFontSize: 14,
  titleFontSize: 16,
  
  // Opacity
  backgroundAlpha: 0.9,        // для кнопок
  panelBackgroundAlpha: 0.68,  // специально для больших панелей (sweet spot для полупрозрачности)
  hoverAlpha: 1.0,
} as const;

/**
 * Create bitmap text with shadow (NES style)
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param x - X position RELATIVE to parent
 * @param y - Y position RELATIVE to parent
 * @param text - Text content
 * @param fontSize - Font size (default: 14)
 * @param color - Text color (default: white)
 * @param originX - X origin (default: 0)
 * @param originY - Y origin (default: 0.5)
 * @returns Object with shadow and text elements
 */
export function createTextWithShadow(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  fontSize: number = NESTheme.defaultFontSize,
  color: number = NESColors.white,
  originX: number = 0,
  originY: number = 0.5
): { shadow: Phaser.GameObjects.BitmapText; text: Phaser.GameObjects.BitmapText } {
  const shadow = scene.add.bitmapText(
    x + NESTheme.shadowOffset,
    y + NESTheme.shadowOffset,
    'pixel-font',
    text,
    fontSize
  );
  shadow.setTintFill(NESColors.black);
  shadow.setOrigin(originX, originY);

  const textObj = scene.add.bitmapText(x, y, 'pixel-font', text, fontSize);
  textObj.setTintFill(color);
  textObj.setOrigin(originX, originY);

  parent.add([shadow, textObj]);

  return { shadow, text: textObj };
}

/**
 * Create NES-style container with border
 * ROOT CONTAINER: Creates at ABSOLUTE coordinates on scene
 * 
 * @param scene - Phaser scene
 * @param x - X position on scene (ABSOLUTE)
 * @param y - Y position on scene (ABSOLUTE)
 * @param width - Container width
 * @param height - Container height
 * @param backgroundColor - Background color (default: gray)
 * @param backgroundAlpha - Background opacity (default: 0.9)
 * @param borderColor - Border color (default: blue)
 * @returns Root container
 */
export function createNESContainer(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  backgroundColor: number = NESColors.gray,
  backgroundAlpha: number = NESTheme.backgroundAlpha,
  borderColor: number = NESColors.blue
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const bgGraphics = scene.add.graphics();

  // Background
  bgGraphics.fillStyle(backgroundColor, backgroundAlpha);
  bgGraphics.fillRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    NESTheme.borderRadius
  );

  // Outer border
  bgGraphics.lineStyle(NESTheme.borderWidthSelected, borderColor, 1);
  bgGraphics.strokeRoundedRect(
    -width / 2,
    -height / 2,
    width,
    height,
    NESTheme.borderRadius
  );

  // Inner border
  bgGraphics.lineStyle(NESTheme.innerBorderWidth, NESColors.lightBlue, 0.8);
  bgGraphics.strokeRoundedRect(
    -width / 2 + 4,
    -height / 2 + 4,
    width - 8,
    height - 8,
    NESTheme.borderRadius - 2
  );

  container.add(bgGraphics);
  return container;
}

/**
 * Create NES-style button
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Button configuration
 * @returns Button elements for manipulation
 */
export interface INESButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  icon?: Phaser.GameObjects.GameObject;
  onClick: () => void;
  selected?: boolean;
}

export interface INESButtonResult {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  textObj?: Phaser.GameObjects.BitmapText;
}

export function createNESButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESButtonConfig
): INESButtonResult {
  const {
    x,
    y,
    width,
    height,
    text,
    icon,
    onClick,
    selected = false,
  } = config;

  const isSelected = selected;

  // Create button container at RELATIVE position
  const buttonContainer = scene.add.container(x, y);

  // Button background — добавляем ПЕРВЫМ (на задний план)
  const bg = scene.add.graphics();
  bg.fillStyle(
    isSelected ? NESColors.gray : NESColors.darkGray,
    NESTheme.backgroundAlpha
  );
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
  bg.lineStyle(
    isSelected ? NESTheme.borderWidthSelected : NESTheme.borderWidth,
    isSelected ? NESColors.yellow : NESColors.blue,
    1
  );
  bg.strokeRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);

  // Inner border for selected
  if (isSelected) {
    bg.lineStyle(NESTheme.innerBorderWidth, NESColors.blue, 0.8);
    bg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, NESTheme.borderRadius - 2);
  }

  bg.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  });

  // Добавляем объекты в правильном порядке: фон → иконка → тень → текст
  buttonContainer.add(bg);
  
  let textObj: Phaser.GameObjects.BitmapText | undefined;
  
  if (icon) {
    // Центрируем иконку относительно центра контейнера (0, 0)
    if ('setPosition' in icon && typeof (icon as any).setPosition === 'function') {
      (icon as any).setPosition(0, height < 40 ? 0 : -20); // -20 = иконка выше текста
    }
    buttonContainer.add(icon);
  }

  if (text) {
    const textY = icon ? height / 2 - 30 : 0; // 0 = вертикальный центр кнопки
    const textColor = isSelected ? NESColors.yellow : NESColors.white;
    
    const { text: textElement } = createTextWithShadow(
      scene,
      buttonContainer,
      0,           // ← X = 0 (центр кнопки)
      textY,       // ← Y относительно центра кнопки
      text,
      NESTheme.defaultFontSize,
      textColor,
      0.5,         // ← центрируем текст по горизонтали
      0.5          // ← центрируем по вертикали относительно своей позиции
    );
    
    textObj = textElement;
    // shadow уже добавлен в createTextWithShadow, text тоже
  }

  parent.add(buttonContainer);

  // Hover effects
  bg.on('pointerover', () => {
    if (!isSelected) {
      bg.clear();
      bg.fillStyle(NESColors.gray, NESTheme.backgroundAlpha);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
      bg.lineStyle(NESTheme.borderWidth, NESColors.blue, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
    }
  });

  bg.on('pointerout', () => {
    if (!isSelected) {
      bg.clear();
      bg.fillStyle(NESColors.darkGray, NESTheme.backgroundAlpha);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
      bg.lineStyle(NESTheme.borderWidth, NESColors.blue, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
    }
  });

  bg.on('pointerdown', onClick);

  return { container: buttonContainer, bg, textObj };
}

/**
 * Create NES-style slider
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Slider configuration
 * @returns Slider elements for manipulation
 */
export interface INESSliderConfig {
  x: number;
  y: number;
  label: string;
  value: number;
  min: number;
  max: number;
  width?: number;
  labelOffset?: number;
  sliderStartX?: number; // Фиксированная позиция начала слайдера (если нужно выравнивание)
  sliderWidth?: number; // Фиксированная ширина слайдера (если нужно выравнивание)
  onChange: (value: number) => void;
}

export interface INESSliderResult {
  container: Phaser.GameObjects.Container;
  thumb: Phaser.GameObjects.Arc;
  valueText: Phaser.GameObjects.BitmapText;
  valueShadow: Phaser.GameObjects.BitmapText;
}

export function createNESSlider(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESSliderConfig
): INESSliderResult {
  const {
    x,
    y,
    label,
    value,
    min,
    max,
    width = 200,
    labelOffset = 110,
    sliderStartX,
    sliderWidth: fixedSliderWidth,
    onChange,
  } = config;

  // Create slider container at RELATIVE position
  const sliderContainer = scene.add.container(x, y);

  // Label with shadow
  createTextWithShadow(
    scene,
    sliderContainer,
    0,
    0,
    label,
    NESTheme.defaultFontSize,
    NESColors.white,
    0,
    0.5
  );

  // Вычисляем ширину label динамически для правильного отступа
  // Создаем временный текст для измерения ширины
  const tempText = scene.add.bitmapText(0, 0, 'pixel-font', label, NESTheme.defaultFontSize);
  const labelWidth = tempText.width;
  tempText.destroy(); // Удаляем временный объект

  // Если переданы фиксированные позиция начала и ширина - используем их для выравнивания
  // Иначе используем динамический расчет на основе ширины label
  let sliderX: number;
  let sliderWidth: number;
  
  if (sliderStartX !== undefined && fixedSliderWidth !== undefined) {
    // Выравнивание: sliderStartX задан относительно родительского контейнера
    // Нужно преобразовать в координаты относительно контейнера слайдера (x, y)
    // sliderStartX - x = позиция начала слайдера относительно контейнера слайдера
    sliderX = sliderStartX - x;
    sliderWidth = fixedSliderWidth;
  } else {
    // Старая логика: используем вычисленную ширину + отступ
    sliderX = labelWidth + (labelOffset === 110 ? 10 : labelOffset - 100);
    sliderWidth = width;
  }

  // Slider track
  const track = scene.add.rectangle(
    sliderX,
    0,
    sliderWidth,
    NESTheme.sliderTrackHeight,
    NESColors.darkGray
  ).setOrigin(0, 0.5);
  const trackBorder = scene.add.graphics();
  trackBorder.lineStyle(NESTheme.innerBorderWidth, NESColors.blue, 0.5);
  trackBorder.strokeRect(
    sliderX - 1,
    -NESTheme.sliderTrackHeight / 2,
    sliderWidth + 2,
    NESTheme.sliderTrackHeight
  );

  // Slider thumb
  const valueRange = max - min;
  const normalizedValue = (value - min) / valueRange;
  const thumbX = sliderX + normalizedValue * sliderWidth;
  const thumb = scene.add.circle(thumbX, 0, NESTheme.sliderThumbRadius, NESColors.yellow)
    .setStrokeStyle(NESTheme.borderWidth, NESColors.blue)
    .setInteractive({ useHandCursor: true, draggable: true });

  // Value display
  const valueX = sliderX + sliderWidth + NESTheme.gap;
  const { shadow: valueShadow, text: valueText } = createTextWithShadow(
    scene,
    sliderContainer,
    valueX,
    0,
    value.toFixed(2),
    12,
    NESColors.white,
    0,
    0.5
  );

  sliderContainer.add([track, trackBorder, thumb]);
  parent.add(sliderContainer);

  // Drag handler
  thumb.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => {
    const newX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderWidth);
    thumb.x = newX;

    const percent = (newX - sliderX) / sliderWidth;
    const newValue = min + percent * valueRange;
    const clampedValue = Phaser.Math.Clamp(newValue, min, max);

    const newValueText = clampedValue.toFixed(2);
    valueText.setText(newValueText);
    valueShadow.setText(newValueText); // Обновляем и тень тоже!

    onChange(clampedValue);
  });

  return { container: sliderContainer, thumb, valueText, valueShadow };
}

/**
 * Create NES-style radio button group
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Radio group configuration
 * @returns Radio group container
 */
export interface INESRadioGroupConfig<T extends string> {
  x: number;
  y: number;
  label: string;
  options: { label: string; value: T }[];
  currentValue: T;
  onChange: (value: T) => void;
}

export interface INESRadioGroupResult {
  container: Phaser.GameObjects.Container;
}

export function createNESRadioGroup<T extends string>(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESRadioGroupConfig<T>
): INESRadioGroupResult {
  const {
    x,
    y,
    label,
    options,
    currentValue,
    onChange,
  } = config;

  // Create radio container at RELATIVE position
  const radioContainer = scene.add.container(x, y);

  // Label with shadow
  createTextWithShadow(
    scene,
    radioContainer,
    0,
    0,
    label,
    NESTheme.defaultFontSize,
    NESColors.white,
    0,
    0.5
  );

  // Radio buttons - add spacing between label and first radio button
  let offsetX = 130; // Fixed offset for consistent spacing
  options.forEach((option) => {
    const isSelected = currentValue === option.value;

    // Circle - aligned with text (Y=0 to match label text vertical center)
    const circle = scene.add.circle(
      offsetX,
      0,
      NESTheme.radioButtonRadius,
      isSelected ? NESColors.yellow : NESColors.gray
    )
      .setStrokeStyle(
        NESTheme.borderWidth,
        isSelected ? NESColors.blue : NESColors.lightBlue
      )
      .setInteractive({ useHandCursor: true });

    // Option label with shadow
    const { text: optionText } = createTextWithShadow(
      scene,
      radioContainer,
      offsetX + NESTheme.radioLabelOffset,
      0,
      option.label,
      12,
      isSelected ? NESColors.yellow : NESColors.white,
      0,
      0.5
    );

    radioContainer.add([circle]);

    // Click handlers
    const handleClick = () => {
      onChange(option.value);
    };

    circle.on('pointerdown', handleClick);
    optionText.setInteractive({ useHandCursor: true });
    optionText.on('pointerdown', handleClick);

    offsetX += NESTheme.radioButtonSpacing;
  });

  parent.add(radioContainer);
  return { container: radioContainer };
}

/**
 * Create section title (NES style)
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param x - X position RELATIVE to parent
 * @param y - Y position RELATIVE to parent
 * @param text - Title text
 * @param fontSize - Font size (default: 16)
 * @returns Title text elements
 */
export interface INESSectionTitleResult {
  shadow: Phaser.GameObjects.BitmapText;
  text: Phaser.GameObjects.BitmapText;
}

export function createSectionTitle(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  text: string,
  fontSize: number = NESTheme.titleFontSize
): INESSectionTitleResult {
  const result = createTextWithShadow(
      scene,
    parent,
    x,
    y,
      text,
      fontSize,
      NESColors.yellow,
      0.5,
      0.5
    );
    
  return result;
}

/**
 * Create NES-style menu button (text with arrow cursor)
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Menu button configuration
 * @returns Menu button elements
 */
export interface INESMenuButtonConfig {
  x: number;
  y: number;
  text: string;
  active?: boolean;
  onClick: () => void;
}

export interface INESMenuButtonResult {
  container: Phaser.GameObjects.Container;
  arrow: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.BitmapText;
}

export function createNESMenuButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESMenuButtonConfig
): INESMenuButtonResult {
  const {
    x,
    y,
    text,
    active = false,
    onClick,
  } = config;

  // Create button container at RELATIVE position
  const buttonContainer = scene.add.container(x, y);

  // Arrow cursor - positioned LEFT of text (like in main menu)
  // Match MenuScene spacing: 20px arrow width, 40px gap between arrow end and text start
  // Arrow points right: tip at left (-60), base at right (-40)
  const arrow = scene.add.graphics();
  arrow.fillStyle(NESColors.yellow);
  arrow.lineStyle(NESTheme.borderWidth, NESColors.black);
  arrow.beginPath();
  arrow.moveTo(-60, -8);  // Left point (tip pointing right)
  arrow.lineTo(-40, 0);    // Right point (base)
  arrow.lineTo(-60, 8);    // Bottom point
  arrow.closePath();
  arrow.fillPath();
  arrow.strokePath();
  arrow.setVisible(false);

  // Blinking animation
  scene.time.addEvent({
    delay: 500,
    callback: () => {
      if (arrow.visible) {
        arrow.setAlpha(arrow.alpha === 1 ? 0.3 : 1);
      }
    },
    loop: true,
  });

  // Text with shadow - positioned RIGHT of arrow (40px spacing after arrow base)
  // Text origin is (0, 0.5) = left-aligned, so text starts at x position
  // Arrow base is at -40, text starts at 0, so gap is 40px (matches MenuScene)
  const { text: textObj } = createTextWithShadow(
    scene,
    buttonContainer,
    0,  // Text starts 40px after arrow base (-40 + 40 = 0)
    0,
    text,
    18,
    active ? NESColors.yellow : NESColors.white,
    0,
    0.5
  );

  buttonContainer.add([arrow]);
  parent.add(buttonContainer);

  // Make text interactive
  textObj.setInteractive({ useHandCursor: true });

  textObj.on('pointerover', () => {
    arrow.setVisible(true);
    arrow.setAlpha(1);
    textObj.setTintFill(NESColors.yellow);
  });

  textObj.on('pointerout', () => {
    arrow.setVisible(false);
    textObj.setTintFill(active ? NESColors.yellow : NESColors.white);
  });

  textObj.on('pointerdown', onClick);

  return { container: buttonContainer, arrow, text: textObj };
}

/**
 * Create NES-style panel with border and padding
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Panel configuration
 * @returns Panel container
 */
export interface INESPanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
  backgroundColor?: number;
  borderColor?: number;
}

export interface INESPanelResult {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
}

export function createNESPanel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESPanelConfig
): INESPanelResult {
  const {
    x,
    y,
    width,
    height,
    padding = NESTheme.padding,
    backgroundColor = NESColors.darkGray,
    borderColor = NESColors.blue,
  } = config;

  // Create panel container at RELATIVE position (x, y is center of panel)
  const panelContainer = scene.add.container(x, y);

  // Panel background with border - draw from center (like buttons)
  const bg = scene.add.graphics();
  bg.fillStyle(backgroundColor, NESTheme.panelBackgroundAlpha ?? NESTheme.backgroundAlpha);
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);
  bg.lineStyle(NESTheme.borderWidth, borderColor, 1);
  bg.strokeRoundedRect(-width / 2, -height / 2, width, height, NESTheme.borderRadius);

  panelContainer.add(bg);
  parent.add(panelContainer);

  // Calculate content area (with padding) - relative to container center (0, 0)
  const contentX = -width / 2 + padding;
  const contentY = -height / 2 + padding;
  const contentWidth = width - padding * 2;
  const contentHeight = height - padding * 2;

  return {
    container: panelContainer,
    bg,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
  };
}

/**
 * Create simple NES-style label (text without interactivity)
 * STRICT MODE: Always requires parent container
 * 
 * @param scene - Phaser scene
 * @param parent - Parent container (REQUIRED)
 * @param config - Label configuration
 * @returns Label text elements
 */
export interface INESLabelConfig {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  color?: number;
  originX?: number;
  originY?: number;
}

export interface INESLabelResult {
  shadow: Phaser.GameObjects.BitmapText;
  text: Phaser.GameObjects.BitmapText;
}

export function createNESLabel(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  config: INESLabelConfig
): INESLabelResult {
  const {
    x,
    y,
    text,
    fontSize = NESTheme.defaultFontSize,
    color = NESColors.white,
    originX = 0,
    originY = 0.5,
  } = config;

  return createTextWithShadow(
    scene,
    parent,
    x,
    y,
    text,
    fontSize,
    color,
    originX,
    originY
  );
}

/**
 * Create NES-style text input field
 * Note: Uses native HTML input for proper text editing
 * Coordinates are in scene space, not container space
 * 
 * @param scene - Phaser scene
 * @param config - Input configuration
 * @returns Input element reference
 */
export interface INESInputConfig {
  x: number;
  y: number;
  width: number;
  height?: number;
  placeholder?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}

export interface INESInputResult {
  element: HTMLInputElement;
  destroy: () => void;
}

export function createNESInput(
  scene: Phaser.Scene,
  config: INESInputConfig
): INESInputResult {
  const {
    x,
    y,
    width,
    height = 24,
    placeholder = '',
    defaultValue = '',
    onChange,
  } = config;

  // Create HTML input element
  const inputElement = document.createElement('input');
  inputElement.type = 'text';
  inputElement.value = defaultValue;
  inputElement.placeholder = placeholder;

  // Get canvas position for proper positioning
  const canvas = scene.game.canvas;
  const canvasRect = canvas.getBoundingClientRect();
  const inputLeft = canvasRect.left + x;
  const inputTop = canvasRect.top + y - height / 2;

  inputElement.style.cssText = `
    position: absolute;
    left: ${inputLeft}px;
    top: ${inputTop}px;
    width: ${width}px;
    height: ${height}px;
    padding: 2px 6px;
    font-size: ${NESTheme.defaultFontSize}px;
    font-family: Arial, sans-serif;
    background-color: #2a3a4e;
    color: #ffffff;
    border: ${NESTheme.borderWidth}px solid #4a5a6e;
    border-radius: ${NESTheme.borderRadius / 2}px;
    outline: none;
    box-sizing: border-box;
  `;

  // Add to body
  document.body.appendChild(inputElement);

  // Input change handler
  if (onChange) {
    inputElement.addEventListener('input', () => {
      onChange(inputElement.value);
    });
  }

  return {
    element: inputElement,
    destroy: () => {
      if (inputElement.parentElement) {
        inputElement.parentElement.removeChild(inputElement);
      }
    },
  };
}

