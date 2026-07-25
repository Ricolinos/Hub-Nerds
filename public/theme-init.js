(function () {
  // Next.js 16.2's own <Script strategy="beforeInteractive"> siempre renderiza
  // un <script dangerouslySetInnerHTML> interno (bootstrap self.__next_s),
  // sin importar src= vs body inline — ver node_modules/next/dist/client/script.js.
  // React 19 marca cualquier <script> así con un warning de solo-desarrollo
  // (el string no existe en los builds *.production.min.js de react-dom, o
  // sea que nunca aparece en producción). No hay fix de Next.js a la fecha
  // (16.2.10 no lo toca); se filtra puntualmente aquí porque este script ya
  // corre antes de la hidratación, a tiempo para instalar el filtro.
  var originalConsoleError = console.error;
  console.error = function () {
    if (
      typeof arguments[0] === "string" &&
      arguments[0].indexOf("Encountered a script tag while rendering React component") !== -1
    ) {
      return;
    }
    return originalConsoleError.apply(console, arguments);
  };
})();

(function () {
  try {
    var root = document.documentElement;

    // El sitio está fijo en tema oscuro (once-ui.config.ts -> style.theme).
    // Este script corre ANTES de hidratar, así que si siguiera leyendo el
    // "data-theme" guardado, un visitante que hubiera elegido claro vería un
    // destello blanco hasta que React montara y ThemeProvider lo corrigiera.
    // Se fuerza oscuro y se limpia la clave vieja para no arrastrarla.
    // Para reactivar el tema claro en el futuro hay que restaurar aquí la
    // lectura de localStorage con su resolución de "system".
    root.setAttribute("data-theme", "dark");
    if (localStorage.getItem("data-theme") !== null) {
      localStorage.removeItem("data-theme");
    }

    var styleKeys = [
      "brand",
      "accent",
      "neutral",
      "solid",
      "solid-style",
      "border",
      "surface",
      "transition",
      "scaling",
      "viz-style",
    ];
    styleKeys.forEach(function (key) {
      var value = localStorage.getItem("data-" + key);
      if (value) {
        root.setAttribute("data-" + key, value);
      }
    });
  } catch (e) {
    console.error("Failed to initialize theme:", e);
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
