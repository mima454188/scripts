// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: chart-line;
/**
 * 组件作者: 95度茅台
 * 组件名称: 全球市值股票
 * 组件版本: Version 1.0.4
 * 发布时间: 2023-12-17
 *
 * 未开盘 0
 * 盘前交易 1
 * 交易中 2
 * 午间休市 3
 * 盘后交易/收市竞价 4
 * 已收盘 5
 * 休市中 7
 */


async function main() {
  const fm = FileManager.local();
  const depPath = fm.joinPath(fm.documentsDirectory(), '95du_module');
  const isDev = false
  
  if (typeof require === 'undefined') require = importModule;
  const { _95du } = require(isDev ? './_95du' : `${depPath}/_95du`);
  
  const pathName = '95du_marketCap';
  const module = new _95du(pathName);
  const setting = module.settings;
  
  const { 
    rootUrl,
    settingPath, 
    cacheImg, 
    cacheStr,
  } = module;
  
  /**
   * 存储当前设置
   * @param { JSON } string
   */
  const writeSettings = async (setting) => {
    fm.writeString(settingPath, JSON.stringify(setting, null, 2));
    console.log(JSON.stringify(
      setting, null, 2
    ));
  };
  
  const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)] || null;
  
  /**
   * 获取 JSON 字符串
   * @param {string} string
   * @returns {object} - JSON
   */
  const getCacheString = async (name, url, headers, cacheTime = 2) => {
    const { type } = module.getFileInfo(name);
    const cache = module.useFileManager({ 
      cacheTime, type 
    });
    const json = cache.read(name);
    if (json) return json;
    const response = await module.apiRequest(url, headers);
    const { ret } = response;
    if (ret === 0) cache.write(name, response);
    return response;
  }; 
  
  /** 
   * 获取 access_token
   * https://www.laohu8.com/quotes?quotesMarket=US
   */
  const access_token = async () => {
    const html = await module.getCacheData('https://www.laohu8.com/m/hq/s/AAPL/wiki', 72)
    const access_token = html.match(/access_token":"([\w.-]+)"/)?.[1];
    return { Authorization: 'Bearer ' + access_token };
  };
  
  // Request parameter
  const random = getRandomItem(setting.values);
  const stockCode = setting.selected === 'random' ? random.value : setting.selected;
  const market = (setting.type === 'HK' || random.type === 'HK') ? 'hkstock/' : '';  
  const tradeStatus = [2, 3, 4].includes(setting.statusCode);
  
  // ===========指数============ //
  const getIndex = async (index) => {
    const { data } = await new Request(`https://betaapi.zhitongcaijing.com/market/quote/market-index.html?area=app_index&dev=0&mainland=1&market=${index}`).loadJSON();
    return data.list;
  };
    
  const getStatistics = async (index) => {
    const { data } = await new Request(`https://betaapi.zhitongcaijing.com/market/quote/market-statistics.html?dev=0&mainland=1&market=${index}`).loadJSON();
    return data;
  };
  
  // 创建三段进度条
  const createThreeStageBar = (total, rise, flat, fall) => {
    const width = 205;
    const height = 5;
    const radius = height / 2;
  
    const ctx = new DrawContext();
    ctx.size = new Size(width, height);
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    
    const [flatWidth, riseWidth, fallWidth] = [flat, rise, fall].map(value => (width * value) / total);
    
    const barInterval = flatWidth < 10 ? 1.5 : 2.5;
    const flatPathWidth = width - (riseWidth + barInterval + fallWidth);
    
    const flatPath = new Path();
    flatPath.addRoundedRect(new Rect(riseWidth + barInterval, 0, flatPathWidth - barInterval, height), radius, radius);
    ctx.addPath(flatPath);
    ctx.setFillColor(Color.lightGray());
    ctx.fillPath();
    
    const path1 = new Path();
    path1.addRoundedRect(new Rect(0, 0, riseWidth, height), radius, radius);
    ctx.addPath(path1);
    ctx.setFillColor(Color.red());
    ctx.fillPath();
    
    const path3 = new Path();
    path3.addRoundedRect(new Rect(riseWidth + flatWidth, 0, fallWidth, height), radius, radius);
    ctx.addPath(path3);
    ctx.setFillColor(Color.green());
    ctx.fillPath();
    
    return ctx.getImage();
  };
  
  // stack
  const riseFallStack = async (total, flat, rise, fall, widget) => {
    const botStack = widget.addStack();
    botStack.layoutHorizontally();
    botStack.centerAlignContent();
    
    const riseText = botStack.addText(rise);
    riseText.font = Font.boldSystemFont(13);
    riseText.textColor = Color.red();
    botStack.addSpacer();
    
    const imageStack = botStack.addStack();
    const progressBar = createThreeStageBar(total, rise, flat, fall);
    imageStack.addImage(progressBar);
    botStack.addSpacer();
    
    const fallText = botStack.addText(fall);
    fallText.textColor = Color.green();
    fallText.font = Font.boldSystemFont(13);
  };
  
  // 创建指数组件
  const renderIndexWidget = async () => {
    const arr = ['us', 'hk', 'a'];
    const index = setting.index === 'random' || !setting.index ? getRandomItem(arr) : setting.index;
    const items = await getIndex(index);
    
    const widget = new ListWidget();
    widget.setPadding(15, 15, 13, 15)
    if (familySize) await setBackground(widget);

    widget.addSpacer(2);
    const mainStack = widget.addStack();
    mainStack.layoutHorizontally();
    
    for (const item of items) {
      const { secuAbbr, price, changeL, change } = item;
    
      const changeValue = parseFloat(changeL.replace(/[^\d.-]/g, ''));
      const allColor = changeValue >= 0 ? '#FF3B30' : '#34C759';
      const stackBgColor = Color.dynamic(new Color(allColor, 0.03), new Color('#222222', 0.7));
      const borderColor = Color.dynamic(new Color(setting.alwaysDark ? '#AAAAAA' : allColor), new Color('#AAAAAA'));
      
      const indexStack = mainStack.addStack();
      indexStack.size = new Size(0, 111);
      indexStack.layoutVertically();
      indexStack.backgroundColor = stackBgColor;
      indexStack.cornerRadius = 12;
      indexStack.borderColor = borderColor;
      indexStack.borderWidth = 1.8
      indexStack.addSpacer();
    
      const titleStack = indexStack.addStack();
      titleStack.addSpacer();
      const titleText = titleStack.addText(secuAbbr);
      titleText.textColor = textColor
      titleText.textOpacity = 0.9
      titleText.font = Font.boldSystemFont(14);
      titleStack.addSpacer();
      indexStack.addSpacer();
    
      const properties = [
        { text: price, font: 17 },
        { text: changeL, font: 13 },
        { text: change, font: 13 }
      ];
    
      properties.forEach(({ text, font }) => {
        const stack = indexStack.addStack();
        stack.addSpacer();
        const contentText = stack.addText(text);
        contentText.textColor = new Color(allColor);
        const fontSize = text === price ? 'boldSystemFont' : 'mediumSystemFont'
        contentText.font = Font[fontSize](font);
        stack.addSpacer();
        
        if (text === price) {
          indexStack.addSpacer(5);
        }
      });
      indexStack.addSpacer();
    
      if ( item !== items[items.length - 1] ) {
        mainStack.addSpacer();
      }
    };
    
    widget.addSpacer();
    
    const { flat, total, rise, fall } = await getStatistics(index);
    const remaining = flat;
    await riseFallStack(total, flat, rise, fall, widget);
  
    return widget;
  };
  
  // ===========图表============ //
  const getColor = (value) => {
    const thresholds = [5, 10, 15, 20, 25];
    const colors = [
      new Color("#00C400"),
      new Color("#BE38F3"),
      new Color("#0083FF"),
      new Color("#F7B500"),
      new Color("#FF9500")
    ];
    
    for (let i = 0; i < thresholds.length; i++) {
      if (value <= thresholds[i]) return colors[i];
    }
    return new Color("#44CB9C75");
  };
  
  const getCountPercentage = (countArr) => {
    const sum = countArr.reduce((acc, value) => acc + value, 0);
    return countArr.map(count => ((count / sum) * 100).toFixed(2));
  };
  
  const formatDate = (date, dateFormat) => {
    const dateFormatter = new DateFormatter();
    dateFormatter.dateFormat = dateFormat;
    return dateFormatter.string(new Date(date));
  };
  
  const numberToWord = (number, convertK = false) => {
    if (number < 0 || number === null) return '--';
    if (number > 1000000) return (number / 1000000).toFixed(1) + 'M';
    if (number > 1000 && convertK) {
      const n = number / 1000;
      return n < 100 ? n.toFixed(1) + 'K' : Math.round(n) + 'K';
    }
    
    const FormatterNumber = number.toLocaleString('en-US');
    return FormatterNumber;
  };
  
  // 获取图表数据
  const getStockTrend = async () => {
    try {
      const stockInfo = tradeStatus ? 'time_trend' : 'candle_stick';
      const url = `https://hq.laohu8.com/${market}/stock_info/${stockInfo}/day/${stockCode}?lang=zh_CN&manualRefresh=true`;
      const headers = await access_token();
      const { items } = await getCacheString(`${stockCode}_chart.json`, url, headers, (tradeStatus ? 2 : 8));
      if (items?.length === 1) {
        const original = items[0];
        for (let i = 0; i < (setting.charts ?? 12); i++) {
          const duplicated = { ...original };
          items.push(duplicated);
        }
      };
      
      const minuteOrDay = tradeStatus ? setting.charts : 7;
      if (items) return items.slice(-minuteOrDay);
      return setting.items;
    } catch (e) {
      console.error(e);
    }
  };
  
  // 水平线
  const drawHorizontalLines = (ctx, size, maximum) => {
    const verticalPadding = 40;
    const leftPadding = 80;
  
    ctx.setTextAlignedRight();
    ctx.setFont(  
      Font.mediumSystemFont(20)
    );
    ctx.setTextColor(Color.gray());
  
    const horizontalLine = new Path();
    for (let i = 0; i <= 4; i++) {
      const yPoint = size.height - ((((size.height - verticalPadding * 2) / 4) * i) + verticalPadding);
      horizontalLine.move(new Point(leftPadding, yPoint));
      horizontalLine.addLine(new Point(size.width, yPoint));
      const text = numberToWord(Math.round(maximum / 4 * i), true);
      ctx.drawTextInRect(text, new Rect(0, yPoint - 12, 60, 20));
    }
  
    // 绘制竖线
    const leftVeLine = new Path();
    const rightVelLine = new Path();
    const leftLineX = leftPadding;
    const rightLineX = size.width
    const y1 = verticalPadding;
    const y2 = size.height - verticalPadding;

    leftVeLine.move(new Point(leftLineX, y1));
    leftVeLine.addLine(new Point(leftLineX, y2));
    rightVelLine.move(new Point(rightLineX, y1));
    rightVelLine.addLine(new Point(rightLineX, y2));

    ctx.addPath(horizontalLine);
    ctx.addPath(leftVeLine);
    ctx.addPath(rightVelLine);
    
    ctx.setStrokeColor(new Color(setting.horizontal || '#FF0000', setting.lineTrans || 0.5))
    ctx.strokePath();
  };
  
  // 柱形图
  const drawBars = (ctx, size, dataSeries, maximum) => {
    const verticalPadding = 40
    const leftPadding = 80;
    const spacing = 4;
    const barWidth = (size.width - ((dataSeries.length - 1) * spacing) - leftPadding) / dataSeries.length;
    const textHeight = 55;
    
    ctx.setTextAlignedCenter();
    const availableHeight = size.height - verticalPadding * 2;
    
    dataSeries.forEach((day, i) => {
      const path = new Path();
      const x = (i * spacing + i * barWidth) + leftPadding;
      const value = day.volume;
      const heightFactor = value / maximum;
      const barHeight = heightFactor * availableHeight;
      const rect = new Rect(x, size.height - barHeight - verticalPadding, barWidth, barHeight);
      path.addRoundedRect(rect, 4, 4)
      ctx.addPath(path);
  
      const result = getCountPercentage(dataSeries.map(item => item.volume));
      const last = new Color('#FF6800');
      const high = new Color('#DF2500');
      
      const maxValue = Math.max(...dataSeries.map(item => item.volume));
      const percentage = getColor(result[i]);
      const color = i === dataSeries.length - 1 ? last : (value === maxValue ? high : percentage);
      
      ctx.setFillColor(color);
      ctx.setFont(
        Font.boldSystemFont(20)
      );
      ctx.setTextColor(Color.gray());
      ctx.fillPath();
  
      const volumeRect = new Rect(x, size.height - barHeight - textHeight - 10, barWidth, textHeight);  
      const minuteRect = new Rect(x, size.height - (verticalPadding - 12), barWidth, textHeight);
      
      const volume = (day.volume >= 10000) ? Math.floor(day.volume / 1000).toString() : (day.volume / 1000).toFixed(1).toString();
      ctx.drawTextInRect(volume, volumeRect);
      ctx.drawTextInRect(day.date, minuteRect);
    })
  };
  
  // 创建图表组件
  const createChart = (data) => {
    const size = new Size(750, 280);
    const ctx = new DrawContext();
    ctx.opaque = false;
    ctx.respectScreenScale = true;
    ctx.size = size;
    
    const dataSeries = data.map(trade => ({ ...trade, date: formatDate(trade.time, tradeStatus ? 'mm' : 'dd') }));
    
    const sorted = [...dataSeries].sort((lhs, rhs) => rhs.volume - lhs.volume);
    const maximum = sorted[0].volume;
  
    drawHorizontalLines(ctx, size, maximum);
    drawBars(ctx, size, dataSeries, maximum);
    return ctx.getImage();
  };
  
  // 创建图表组件
  const chartWidget = async () => {
    const widget = new ListWidget();
    widget.setPadding(0, 15, 0, 15);
    const nameStack = widget.addStack();
    const symbolText = nameStack.addText(nameCN +  `  ${tradeStatus ? '( 分时 )' : '( 日 K )'} ` + _volume);
    symbolText.textColor = textColor;
    symbolText.textOpacity = 0.65;
    symbolText.font = Font.boldSystemFont(14);
    widget.addSpacer(5);
    
    const chartStack = widget.addStack();
    chartStack.size = new Size(325, 0);
    const data = await getStockTrend();
    const chart = await createChart(data);
    chartStack.addImage(chart);
    const maxLength = Math.max(...data.map(item => String(item.volume).length));
    chartStack.setPadding(0, maxLength <= 7 ? -3 : 0, 0, 0);
    
    widget.url = `https://www.laohu8.com/m/hq/s/${stockCode}/wiki`;
    return widget;
  };
  
  // ============市值=========== //

  // 获取市值股票数据
  const fetchData = async () => {
    try {
      const url = `https://hq.laohu8.com/${market}stock_info/detail/${stockCode}?lang=zh_CN`;
      const headers = await access_token();
      const { items } = await getCacheString(`${stockCode}_detail.json`, url, headers, (tradeStatus === true ? 0 : 8));
      return items?.[0];
    } catch (error) {
      console.error(error);
      await fetchData();
    }
  };
  
  const { symbol, nameCN, marketStatus, marketStatusCode, latestTime, latestPrice, change, preClose, postHourTrading, high, low, volume, open, shares, floatShares, amount, eps, ttmEps } = await fetchData() || {};
  
  const colors = [
    '#FFD723', 
    '#FF9500', 
    '#0088FF', 
    '#00C400', 
    '#14BAFF'
  ];
  const barColor = new Color(getRandomItem(colors));
  
  const statusMap = {
    1: '#FF6600',
    2: '#DF2500',
    4: '#FF6600'
  };
  const statusColor = statusMap[marketStatusCode] ?? '#666'
  
  const usIcons = [
   'http://img.zhitongcaijing.com/quote/us.png',
  'http://img.zhitongcaijing.com/quote/usl0.png'
  ];
  
  const randomIcons = [
    "http://img.zhitongcaijing.com/quote/tong@2x.png",
    "http://img.zhitongcaijing.com/quote/gu@2x.png" 
  ];
  
  const hkIcons = [
    "http://img.zhitongcaijing.com/quote/hk@2x.png",
    "http://img.zhitongcaijing.com/quote/l03x.png",
    getRandomItem(randomIcons)
  ];
  
  const changeColor = change >= 0 ? '#FD4A67' : '#00B388';
  const changePColor = change >= 0 ? '#00C400' : '#FFD723';
  
  const nameColors = [
    '#FFD723',
    setting.titleColor
  ];
  const nameColor = new Color(getRandomItem(nameColors));
  
  const blueColor = new Color(colors.pop());
  
  const textColor = Color.dynamic(new Color(setting.lightColor), new Color(setting.darkColor));
  
  //转换市值
  const formatUnit = (marketCap) => marketCap >= 1e12 ? '万亿' : '亿';
  const formatMarketCap = (marketCap) => (marketCap >= 1e12) ? (marketCap / 1e12).toFixed(2) : Math.floor(marketCap / 1e8);
  
  // 转换涨跌和涨跌幅
  const changeSign = (change >= 0) ? '+' : '-';
  const changeText = `${changeSign}${Math.abs(change.toFixed(2))}`;
  const changePercentage = ((change / preClose) * 100).toFixed(2);
  
  const changePercentageSign = (change >= 0) ? '+' : '-';
  const changePercentageText = `${changePercentageSign}${Math.abs(changePercentage)}%`;
  
  // 转换万亿
  const totalMarketCap = formatMarketCap(latestPrice * shares);
  const totalUnit = formatUnit(latestPrice * shares);
  
  const circulatingMarketCap = formatMarketCap(latestPrice * floatShares);
  const circulatingUnit = formatUnit(latestPrice * floatShares);
  
  // 转换其他值
  const _volume = Math.floor(volume / 1e4) + '万';
  const amplitude = ((high - low) / preClose * 100).toFixed(2);
  const totalShares = (shares / 1e8).toFixed(2) + '亿';
  const turnover = (amount / 1e8).toFixed(2) + '亿';
  const turnoverRate = (volume / shares * 100).toFixed(2) + '%';
  const circulatingShares = (floatShares / 1e8).toFixed(2) + '亿'
  const earningsPerShare = eps.toFixed(2);
  const priceToEarningsRatio = (latestPrice / ttmEps).toFixed(2); 
  
  // 交易状态变化通知
  if (marketStatusCode !== setting.statusCode) {
    module.notify(`${nameCN} ( ${symbol} ) ${marketStatusCode}`, `[ ${marketStatus} ] 最新价格: ${latestPrice.toFixed(2)}，市值: ${totalMarketCap}${totalUnit}`);
    
    if (marketStatusCode === 2) {
      setting.items = await getStockTrend();
    }
    
    setting.statusCode = marketStatusCode;
    writeSettings(setting);
  };
  
  // ========== //
  const pointsData = () => {
    const ratio = [
      {
        label: '日振幅', 
        value: `${amplitude}%`, 
        color: blueColor
      },
      {
        label: '换手率', 
        value: turnoverRate,
        color: blueColor
      },
      {
        label: '市盈率', 
        value: priceToEarningsRatio, 
        color: blueColor
      },
      {
        label: '每股盈', 
        value: earningsPerShare, 
        color: blueColor
      }
    ];
    
    const points = [
      { 
        label: '最高价', 
        value: high.toFixed(2),
        color: textColor
      },
      { 
        label: '最低价', 
        value: low.toFixed(2),
        color: textColor
      },
      { 
        label: '成交量', 
        value: _volume, 
        color: textColor 
      },
      { 
        label: '今日开', 
        value: open.toFixed(2), 
        color: textColor 
      },
      { 
        label: '昨日收', 
        value: preClose.toFixed(2), 
        color: textColor 
      },
      getRandomItem(ratio),
      { 
        label: '成交额', 
        value: turnover, 
        color: textColor 
      }
    ];
    
    const getRandomIndex = (length, excludeIndex) => {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * length);
      } while (randomIndex === excludeIndex);
      return randomIndex;
    };
      
    const redIndex = getRandomIndex(points.length);
    const greenIndex = getRandomIndex(points.length, redIndex);
    points[redIndex].color = new Color('#FF0000');
    points[greenIndex].color = new Color('#00C400');

    return points;
  };
  
  // config finally Size
  const familyWidget = config.widgetFamily;
  switch (familyWidget) {
    case 'small':
      marketPriSize = 28;
      marketTSize = 12;
      dollarSize = 15;
      descSize = 11;
      hkSize = 12;
      spacer = 9;
      barSize = 48;
      changeGap = 12;
      staBarSize = 1.7,
      familySize = false;
      break;
    default:
      marketPriSize = 30;
      marketTSize = 13;
      dollarSize = 16;
      descSize = 12;
      hkSize = 13;
      spacer = 10;
      barSize = 50;
      changeGap = 16;
      staBarSize = 1.7,
      familySize = true;
  };
  
  // 设置组件背景
  const setBackground = async (widget) => {
    const bgImage = fm.joinPath(cacheImg, Script.name());
    if (fm.fileExists(bgImage)) {
      const image = fm.readImage(bgImage);
      widget.backgroundImage = await module.shadowImage(image);
    } else if (!setting.solidColor && !Device.isUsingDarkAppearance()) {
      widget.backgroundGradient = module.createGradient();
    } else {
      const urls = [
        `${rootUrl}/img/background/glass_1.png`,  
        `${rootUrl}/img/background/glass_2.png`];
      const randomUrl = module.getRandomItem(urls);
      const randomBackgroundImage = await module.getCacheData(randomUrl);
      widget.backgroundImage = randomBackgroundImage;
    }
  };
  
  //=========> Create <=========//
  const renderWidget = async () => {
    const widget = new ListWidget();
    widget.setPadding(15, 18, 15, 18)
    const mainStack = module.createStack(widget);
    const leftStack = mainStack.addStack();
    leftStack.layoutVertically();
    
    // first Column Bar
    const barStack = module.createStack(leftStack);
    module.createStack(barStack, 'horizontal', barColor.hex, new Size(6, barSize), 50);
    barStack.addSpacer(spacer);
    
    const firstStack = barStack.addStack();
    firstStack.layoutVertically();
    const marketStack = firstStack.addStack();
    marketStack.layoutHorizontally();
    
    const marketCapText = marketStack.addText(`${totalMarketCap}`);
    marketCapText.textColor = textColor;
    marketCapText.font = Font.boldSystemFont(marketPriSize);
    const unitText = marketStack.addText(totalUnit);
    unitText.textOpacity = 0.8;
    unitText.textColor = textColor;
    unitText.font = Font.boldSystemFont(descSize);
    
    const marketTimeText = firstStack.addText(familySize ? latestTime : `${nameCN}  ${symbol}`);
    marketTimeText.textColor = textColor;
    marketTimeText.font = Font.mediumSystemFont(marketTSize);
    marketTimeText.textOpacity = 0.7;
    leftStack.addSpacer();
    
    // stock status
    const stateStack = module.createStack(leftStack);
    const borStack = stateStack.addStack();
    borStack.backgroundColor = new Color(statusColor);
    borStack.setPadding(staBarSize, 6, staBarSize, 6);
    borStack.cornerRadius = 5;
    
    const statusText = borStack.addText(marketStatus);
    statusText.textColor = Color.white();
    statusText.textOpacity = 0.9;
    statusText.font = Font.boldSystemFont(descSize);
    stateStack.addSpacer(10);
    
    if (familySize || marketStatus.length <= 5) {
      for (item of !market ? usIcons : hkIcons) {
        stateStack.addSpacer(3);
        const icons = await module.getCacheData(item);
        const shareIcon = stateStack.addImage(icons);
        shareIcon.imageSize = new Size(17, 17);
      }
    };
    leftStack.addSpacer();
    
    // second Column Bar
    const barStack2 = module.createStack(leftStack);
    module.createStack(barStack2, 'horizontal', setting.columnBarColor, new Size(6, barSize), 50);
    barStack2.addSpacer(spacer);
    
    const secondStack = barStack2.addStack();
    secondStack.layoutVertically();    
    const priceStack = secondStack.addStack();
    priceStack.layoutHorizontally();
    
    const latestPriceText = priceStack.addText(latestPrice.toFixed(2));
    latestPriceText.textColor = new Color(changeColor);
    latestPriceText.font = Font.boldSystemFont(marketPriSize);
    
    const dollarText = priceStack.addText(!market ? '$' : 'HK');
    dollarText.textColor = textColor;
    dollarText.textOpacity = 0.8;
    dollarText.font = Font.mediumSystemFont(!market ? dollarSize : hkSize);
    
    //
    const changeStack = module.createStack(secondStack);
    
    const changeTextElement = changeStack.addText(changeText);
    changeTextElement.textColor = new Color(changePColor);
    changeTextElement.font = Font.mediumSystemFont(13);
    changeStack.addSpacer(changeGap);
    
    const changePercentText = changeStack.addText(changePercentageText);
    changePercentText.textColor = new Color(changePColor);
    changePercentText.font = Font.mediumSystemFont(13);
    changeStack.addSpacer(5);
    
    const sfSymbol = SFSymbol.named(change > 0 ? 'arrow.up' : 'arrow.down');
    const icon = changeStack.addImage(sfSymbol.image);
    icon.imageSize = new Size(13, 13)
    icon.tintColor = new Color(changeColor);
    barStack2.addSpacer();
    
    /** 
     * medium size widget
     * stock details
     */
    if (familySize) {
      mainStack.addSpacer();
      const rightStack = mainStack.addStack();
      rightStack.layoutVertically();
      rightStack.size = new Size(nameCN.length >= 4 || symbol.length >= 5 ? 142 : 130 , 0);
      
      const nameStack = module.createStack(rightStack);
      
      const symbolText = nameStack.addText(nameCN);
      symbolText.textColor = nameColor;
      symbolText.font = Font.boldSystemFont(18);
      nameStack.addSpacer();
      
      const nameText = nameStack.addText(symbol);
      nameText.textColor = nameColor;
      nameText.font = Font.boldSystemFont(18);
      rightStack.addSpacer();
      
      // stock Details
      const points = pointsData();
      for (const point of points) {
        rightStack.addSpacer(0.5);
        const stack = module.createStack(rightStack);
      
        const labelText = stack.addText(point.label);
        labelText.textColor = point.color;
        labelText.textOpacity = 0.85;
        labelText.font = Font.mediumSystemFont(13);
        stack.addSpacer();
      
        const valueText = stack.addText(point.value);
        valueText.textColor = point.color;
        valueText.textOpacity = 0.85;
        valueText.font = Font.mediumSystemFont(13);
      }
    };
    
    widget.url = `https://www.laohu8.com/m/hq/s/${stockCode}/wiki`;
    if (familySize) await setBackground(widget);
    return widget;
  };
  
  const errorWidget = async () => {
    const widget = new ListWidget();
    const text = widget.addText('添加小号，中号组件');
    text.font = Font.systemFont(17);
    text.textColor = textColor;
    text.centerAlignText();
    return widget;
  };
  
  const runWidget = async () => {
    const isChartParam = args.widgetParameter === '图表' && familyWidget === 'medium';
    const isIndexParam = args.widgetParameter === '指数' && familyWidget === 'medium';
    
    const widget = await (familyWidget !== 'large' 
      ? (isChartParam 
        ? chartWidget() 
        : isIndexParam 
          ? renderIndexWidget()
          : renderWidget())
      : errorWidget());
    
    if (setting.alwaysDark) widget.backgroundColor =  Color.black();
    
    if (config.runsInApp) {
      await widget.presentMedium();
    } else {
      widget.refreshAfterDate = new Date(Date.now() + 1000 * 60 * Number(setting.refresh));
      Script.setWidget(widget);
      Script.complete();
    }
  }
  await runWidget();
};
module.exports = { main }