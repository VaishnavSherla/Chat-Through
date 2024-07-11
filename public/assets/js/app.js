!function(e){"use strict";
    var o,t;

    e(".dropdown-menu a.dropdown-toggle").on("click",function(t){
        return e(this).next().hasClass("show")||e(this).parents(".dropdown-menu").first().find(".show").removeClass("show"),
        e(this).next(".dropdown-menu").toggleClass("show"),!1
    });

    [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]')).map(function(t){
        return new bootstrap.Tooltip(t)
    });

    [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]')).map(function(t){
        return new bootstrap.Popover(t)
    });

    o=document.getElementsByTagName("body")[0];

    // Initialize layout mode from local storage
    var layoutMode = localStorage.getItem("layoutMode");
    if (layoutMode) {
        document.body.setAttribute("data-layout-mode", layoutMode);
    }

    t=document.querySelectorAll(".light-dark-mode");
    if (t && t.length) {
        t.forEach(function(t){
            t.addEventListener("click",function(t){
                if (o.hasAttribute("data-layout-mode") && o.getAttribute("data-layout-mode") === "dark") {
                    document.body.setAttribute("data-layout-mode", "light");
                    localStorage.setItem("layoutMode", "light"); // Save to local storage
                } else {
                    document.body.setAttribute("data-layout-mode", "dark");
                    localStorage.setItem("layoutMode", "dark"); // Save to local storage
                }
            });
        });
    }

    Waves.init();
}(jQuery);
