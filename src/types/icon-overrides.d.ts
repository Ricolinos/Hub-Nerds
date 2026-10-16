// Registro de los íconos personalizados del proyecto ante Once UI 2.0.
//
// Once UI 2.0 tipa `IconName` como unión real (built-ins + lo declarado en
// `IconLibraryOverrides`). Los íconos propios del repo viven en
// `src/resources/icons.ts` (`iconLibrary`) y se pasan a `IconProvider`; esta
// declaración los agrega al tipo para que TypeScript los acepte.
//
// Fuente: node_modules/@once-ui-system/core/dist/icons.d.ts
export {};

declare module "@once-ui-system/core" {
  interface IconLibraryOverrides {
    arrowUpRight: true;
    arrowLeft: true;
    arrowRight: true;
    email: true;
    globe: true;
    person: true;
    grid: true;
    book: true;
    openLink: true;
    calendar: true;
    home: true;
    gallery: true;
    discord: true;
    eye: true;
    eyeOff: true;
    github: true;
    linkedin: true;
    x: true;
    twitter: true;
    threads: true;
    arrowUpRightFromSquare: true;
    document: true;
    rocket: true;
    film: true;
    sparkles: true;
    paintBrush: true;
    userGroup: true;
    codeBracket: true;
    briefcase: true;
    infoCircle: true;
    creditCard: true;
    search: true;
    settings: true;
    logOut: true;
    heart: true;
    heartSolid: true;
    mockup: true;
    plugin: true;
    download: true;
    plus: true;
    minus: true;
    mapPin: true;
    edit: true;
    refreshCw: true;
    helpCircle: true;
    folder: true;
    attach: true;
    compare: true;
    carousel: true;
    audio: true;
    trash: true;
    bell: true;
    phone: true;
    video: true;
    play: true;
    pause: true;
    chat: true;
    check: true;
    chevronDown: true;
    chevronUp: true;
    shield: true;
    warning: true;
    xCircle: true;
    divider: true;
    carouselSlides: true;
    photoGrid: true;
    photoStack: true;
    swipeStrip: true;
    sectionDivider: true;
    bold: true;
    italic: true;
    underline: true;
    strikethrough: true;
    listBullets: true;
    listNumbers: true;
    textLight: true;
    textStrong: true;
    alignLeft: true;
    alignCenter: true;
    alignRight: true;
    alignJustify: true;
    link: true;
    emoji: true;
    images: true;
    camera: true;
    shapes: true;
    dragHandle: true;
    moreVertical: true;
    javascript: true;
    nextjs: true;
    supabase: true;
    figma: true;
    facebook: true;
    google: true;
    pinterest: true;
    whatsapp: true;
    reddit: true;
    telegram: true;
    instagram: true;
    behance: true;
  }
}
