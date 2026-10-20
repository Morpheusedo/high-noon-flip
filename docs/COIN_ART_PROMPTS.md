# Монеты для коллекции: промпты для Gemini

Пять монет, у каждой две стороны (Sheriff и Outlaw) и иконка. Всего 15 файлов.
Промпты на английском: Gemini так точнее держит детали. Всё уже подставлено,
копируйте блоки как есть.

## Перед началом

- Исходники лежат в `public/assets/images/coins/`: `classic-sheriff.webp` и
  `classic-outlaw.webp`. Если Gemini не принимает webp, откройте файл в «Просмотре» и
  сохраните как PNG (Файл → Экспортировать).
- Мы не рисуем монету с нуля, а перекрашиваем нашу. Так совпадут ракурс, размер в кадре
  и свет, и в игре ничего не придётся перемерять.
- Каждая монета — новый чат. Сначала сторона Sheriff, потом в том же чате сторона Outlaw.
- Если результат не нравится, жмите «перегенерировать» с тем же промптом. Менять
  промпт стоит, только если ошибка повторяется 3 раза подряд.

---

## 1. Silver — серебряная

Открывается за 50 бросков. Файлы: `silver-sheriff.webp`, `silver-outlaw.webp`,
`silver-icon.webp`.

### Шаг 1. Sheriff

Новый чат, прикрепите `classic-sheriff.webp`:

```
Edit the attached image. It is a casino game coin seen straight on.
Keep its shape exactly: the same framing and size in the frame, the same circle,
rim and rope border, the same star emblem, the same ribbon and the word "SHERIFF"
with exactly the same letters.
Change only the material and finish to: worn polished silver, cool grey-white metal,
bright highlights on the raised star and the ribbon, darker oxidised silver in the
recesses, fine scratches along the rim.
Keep the lighting from the top left, as in the original.
Flat solid #00FF00 green background. No shadow under the coin, no glow outside the
coin, no added text, no frame, nothing outside the coin.
Square 1:1, sharp, high detail, game asset.
```

### Шаг 2. Outlaw

В том же чате прикрепите две картинки: сначала готовую серебряную Sheriff, потом
`classic-outlaw.webp`:

```
Two images are attached. Redo the second image (the OUTLAW coin) in exactly the same
material, colour, wear and lighting as the first image: worn polished silver.
Keep the second image's design exactly: the crossed revolvers, the ribbon, the word
"OUTLAW" with the same letters, the rim, the framing and the size in the frame.
Flat solid #00FF00 green background, the same as the first image. No shadow, no glow,
no added text.
Square 1:1, sharp, high detail, game asset.
```

---

## 2. Rusty — ржавая

Открывается за три серии от 3-й ступени. Файлы: `rusty-sheriff.webp`,
`rusty-outlaw.webp`, `rusty-icon.webp`.

### Шаг 1. Sheriff

Новый чат, прикрепите `classic-sheriff.webp`:

```
Edit the attached image. It is a casino game coin seen straight on.
Keep its shape exactly: the same framing and size in the frame, the same circle,
rim and rope border, the same star emblem, the same ribbon and the word "SHERIFF"
with exactly the same letters.
Change only the material and finish to: old rusted iron, orange-brown rust flaking in
places, dark red-brown in the recesses, a few grey-green patina spots, matte with no
shine, the raised design still clearly readable.
Keep the lighting from the top left, as in the original.
Flat solid #00FF00 green background. No shadow under the coin, no glow outside the
coin, no added text, no frame, nothing outside the coin.
Square 1:1, sharp, high detail, game asset.
```

### Шаг 2. Outlaw

В том же чате прикрепите две картинки: сначала готовую ржавую Sheriff, потом
`classic-outlaw.webp`:

```
Two images are attached. Redo the second image (the OUTLAW coin) in exactly the same
material, colour, wear and lighting as the first image: old rusted iron, matte, with
flaking orange-brown rust.
Keep the second image's design exactly: the crossed revolvers, the ribbon, the word
"OUTLAW" with the same letters, the rim, the framing and the size in the frame.
Flat solid #00FF00 green background, the same as the first image. No shadow, no glow,
no added text.
Square 1:1, sharp, high detail, game asset.
```

---

## 3. Bullet-holed — пробитая пулей

Открывается, если забрать выигрыш от ×4. Файлы: `holed-sheriff.webp`,
`holed-outlaw.webp`, `holed-icon.webp`.

### Шаг 1. Sheriff

Новый чат, прикрепите `classic-sheriff.webp`:

```
Edit the attached image. It is a casino game coin seen straight on.
Keep its shape exactly: the same framing and size in the frame, the same circle,
rim and rope border, the same star emblem, the same ribbon and the word "SHERIFF"
with exactly the same letters.
Keep the same brass material as the original, and add one bullet hole straight
through the coin in the upper right area of the flat field, not touching the star or
the ribbon. The hole is see-through, showing the background. Its edges are torn
slightly outward and scorched dark, with light soot around it.
Keep the lighting from the top left, as in the original.
Flat solid #00FF00 green background, also visible through the hole. No shadow under
the coin, no glow outside the coin, no added text, no frame, nothing outside the coin.
Square 1:1, sharp, high detail, game asset.
```

### Шаг 2. Outlaw

В том же чате прикрепите две картинки: сначала готовую пробитую Sheriff, потом
`classic-outlaw.webp`:

```
Two images are attached. Redo the second image (the OUTLAW coin) with exactly the same
brass, wear and lighting as the first image, and the same bullet hole: see-through,
torn slightly outward, scorched dark, with light soot. On this side the hole is in the
lower right area of the flat field (the coin turns over top to bottom, so the back of a
hole in the upper right sits in the lower right), not touching the revolvers or the
ribbon.
Keep the second image's design exactly: the crossed revolvers, the ribbon, the word
"OUTLAW" with the same letters, the rim, the framing and the size in the frame.
Flat solid #00FF00 green background, also visible through the hole. No shadow, no
glow, no added text.
Square 1:1, sharp, high detail, game asset.
```

В игре монета переворачивается сверху вниз, поэтому сквозная дырка на обороте видна
отражённой по вертикали: на стороне Outlaw она справа внизу. Проверьте: если наложить
Outlaw на Sheriff и отразить по вертикали, дырки должны совпасть.

---

## 4. Gold — золотая

Открывается на 5-й ступени. Файлы: `gold-sheriff.webp`, `gold-outlaw.webp`,
`gold-icon.webp`.

### Шаг 1. Sheriff

Новый чат, прикрепите `classic-sheriff.webp`:

```
Edit the attached image. It is a casino game coin seen straight on.
Keep its shape exactly: the same framing and size in the frame, the same circle,
rim and rope border, the same star emblem, the same ribbon and the word "SHERIFF"
with exactly the same letters.
Change only the material and finish to: rich polished gold, warm yellow gold with
strong mirror highlights, deeper amber in the recesses, a bright mirror-like rim;
pure gold, not orange and not brass.
Keep the lighting from the top left, as in the original.
Flat solid #00FF00 green background. No shadow under the coin, no glow outside the
coin, no added text, no frame, nothing outside the coin.
Square 1:1, sharp, high detail, game asset.
```

### Шаг 2. Outlaw

В том же чате прикрепите две картинки: сначала готовую золотую Sheriff, потом
`classic-outlaw.webp`:

```
Two images are attached. Redo the second image (the OUTLAW coin) in exactly the same
material, colour, wear and lighting as the first image: rich polished yellow gold with
mirror highlights, not orange and not brass.
Keep the second image's design exactly: the crossed revolvers, the ribbon, the word
"OUTLAW" with the same letters, the rim, the framing and the size in the frame.
Flat solid #00FF00 green background, the same as the first image. No shadow, no glow,
no added text.
Square 1:1, sharp, high detail, game asset.
```

---

## 5. Lucky — счастливая

Самая редкая, открывается на вершине лестницы. Файлы: `lucky-sheriff.webp`,
`lucky-outlaw.webp`, `lucky-icon.webp`.

Фон здесь пурпурный, а не зелёный: у монеты зелёная эмаль, и при удалении зелёного
фона она пропала бы вместе с ним.

### Шаг 1. Sheriff

Новый чат, прикрепите `classic-sheriff.webp`:

```
Edit the attached image. It is a casino game coin seen straight on.
Keep its shape exactly: the same framing and size in the frame, the same circle,
rim and rope border, the same star emblem, the same ribbon and the word "SHERIFF"
with exactly the same letters.
Change only the material and finish to: aged brass with deep emerald-green enamel
filling the flat field and the ribbon, the raised star and the letters in bright
brass, a small four-leaf clover stamped into the rim at the bottom, a subtle sparkle
on the enamel.
Keep the lighting from the top left, as in the original.
Flat solid #FF00FF magenta background. No shadow under the coin, no glow outside the
coin, no added text, no frame, nothing outside the coin.
Square 1:1, sharp, high detail, game asset.
```

### Шаг 2. Outlaw

В том же чате прикрепите две картинки: сначала готовую счастливую Sheriff, потом
`classic-outlaw.webp`:

```
Two images are attached. Redo the second image (the OUTLAW coin) in exactly the same
material, colour, wear and lighting as the first image: aged brass with deep
emerald-green enamel in the flat field and the ribbon, the raised design and letters
in bright brass, and the same small four-leaf clover stamped into the rim at the bottom.
Keep the second image's design exactly: the crossed revolvers, the ribbon, the word
"OUTLAW" with the same letters, the rim, the framing and the size in the frame.
Flat solid #FF00FF magenta background, the same as the first image. No shadow, no
glow, no added text.
Square 1:1, sharp, high detail, game asset.
```

---

## Иконки

Отдельно генерировать не нужно: уменьшите готовую сторону Sheriff каждой монеты до
256×256 и сохраните как `<монета>-icon.webp`. Так иконка точно совпадёт с монетой.
Силуэт для закрытых монет игра рисует сама.

Если на маленьком размере иконка плохо читается, в чате нужной монеты прикрепите её
готовую сторону Sheriff и отправьте промпт. Для Lucky замените фон на `#FF00FF magenta`.

```
Make a small game icon from the attached coin: the same coin, filling 92% of the
frame, slightly stronger contrast and a thin dark outline around the rim so it reads
at 64 px. Flat solid #00FF00 green background. No shadow, no added text. Square 1:1.
```

---

## Обработка каждого файла

1. **Фон.** Уберите зелёный (у Lucky пурпурный) в Photoshop (Select → Color Range) или
   на remove.bg. У пробитой монеты фон должен уйти и из дырки.
2. **Надписи.** Проверьте буквы: SHERIFF — одна R и две F; OUTLAW. Если Gemini исказил
   ленту, перенесите её со старой монеты в редакторе: это быстрее, чем генерировать
   заново.
3. **Размер.** 1024×1024, монета по центру и того же размера, что в оригинале. Проще
   всего положить файл слоем поверх `classic-sheriff.webp` и сравнить края.
4. **Пара сторон.** Поставьте Sheriff и Outlaw рядом: цвет металла и износ должны быть
   одинаковыми, иначе при перевороте монета будет «мигать».
5. **Экспорт.** WebP с прозрачностью, качество около 90.
6. **Куда класть.** В `public/assets/images/coins/` с заменой заглушек, с теми же
   именами файлов, что указаны у каждой монеты.

Когда файлы будут на месте, скажите: цвет ребра монеты в полёте задан в `coins.json`
под каждую монету, его нужно подогнать под новый арт.

## Перед релизом

- Спросите провайдера, принимает ли он арт, сделанный нейросетью: некоторые требуют,
  чтобы права на ассеты принадлежали им. Для концепта это не важно.
