// src/views/menu.ts
interface MenuItem {
  name: string;
  origin?: string;
  description: string;
}

interface MenuSubcategory {
  id: string;
  title: string;
  items: MenuItem[];
}

interface MenuCategory {
  id: string;
  title: string;
  items?: MenuItem[];
  subcategories?: MenuSubcategory[];
}

interface MenuData {
  menu: {
    title: string;
    categories: MenuCategory[];
  };
}

async function loadMenuData(): Promise<MenuData> {
  const base = (import.meta as any).env.BASE_URL || "/";
  const timestamp = Date.now();
  const res = await fetch(`${base}data/menu.json?v=${timestamp}`, { 
    cache: "no-cache",
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
  if (!res.ok) throw new Error(`Failed to load menu: ${res.status}`);
  return res.json();
}

function createMenuItem(item: MenuItem): HTMLElement {
  const menuItem = document.createElement("div");
  menuItem.className = "menu-item";

  const header = document.createElement("div");
  header.className = "menu-item-header";

  const name = document.createElement("h4");
  name.className = "menu-item-name";
  name.textContent = item.name;

  const origin = document.createElement("span");
  origin.className = "menu-item-origin";
  if (item.origin && item.origin !== "—") {
    origin.textContent = item.origin;
  }

  header.appendChild(name);
  if (item.origin && item.origin !== "—") {
    header.appendChild(origin);
  }

  const description = document.createElement("p");
  description.className = "menu-item-description";
  description.textContent = item.description;

  menuItem.appendChild(header);
  menuItem.appendChild(description);

  return menuItem;
}

function createSubcategorySection(subcategory: MenuSubcategory): HTMLElement {
  const section = document.createElement("div");
  section.className = "menu-subcategory";

  const title = document.createElement("h4");
  title.className = "menu-subcategory-title";
  title.textContent = subcategory.title;

  const items = document.createElement("div");
  items.className = "menu-items";

  subcategory.items.forEach(item => {
    items.appendChild(createMenuItem(item));
  });

  section.appendChild(title);
  section.appendChild(items);

  return section;
}

function createCategoryContent(category: MenuCategory): HTMLElement {
  const content = document.createElement("div");
  content.className = "menu-category-content";
  content.style.display = "none";

  if (category.items) {
    // Simple category with direct items
    const items = document.createElement("div");
    items.className = "menu-items";

    category.items.forEach(item => {
      items.appendChild(createMenuItem(item));
    });

    content.appendChild(items);
  } else if (category.subcategories) {
    // Category with subcategories (like dinner)
    const subcategoriesContainer = document.createElement("div");
    subcategoriesContainer.className = "menu-subcategories";

    category.subcategories.forEach(subcategory => {
      subcategoriesContainer.appendChild(createSubcategorySection(subcategory));
    });

    content.appendChild(subcategoriesContainer);
  }

  return content;
}

function createCategoryButton(category: MenuCategory): HTMLElement {
  const button = document.createElement("button");
  button.className = "menu-category-button";

  // Add icons for each category using PNG sprites
  const icons: Record<string, string> = {
    breakfast: "/assets/breakfast-icon.png",
    dinner: "/assets/dinner-icon.png",
    sides: "/assets/sides-icon.png",
    drinks: "/assets/drinks-icon.png"
  };

  if (icons[category.id]) {
    const icon = document.createElement("img");
    icon.src = icons[category.id];
    icon.alt = `${category.title} icon`;
    icon.className = "menu-category-icon";
    
    const text = document.createElement("span");
    text.textContent = category.title;
    
    button.appendChild(icon);
    button.appendChild(text);
  } else {
    button.textContent = category.title;
  }

  return button;
}

function createLoader(): HTMLElement {
  const loader = document.createElement("div");
  loader.className = "menu-loader";
  loader.innerHTML = `
    <div class="menu-spinner">
      <div></div><div></div><div></div>
    </div>
    <p>Loading menu...</p>
  `;
  return loader;
}

export default function MenuView(): HTMLElement {
  const root = document.createElement("div");
  root.className = "menu-view";

  const menuContainer = document.createElement("div");
  menuContainer.id = "menu";
  menuContainer.className = "menu-container";

  const loader = createLoader();
  menuContainer.appendChild(loader);

  // Load menu data
  loadMenuData()
    .then(data => {
      // Remove loader
      loader.remove();

      // Create header
      const header = document.createElement("header");
      header.className = "menu-header";

      const title = document.createElement("h1");
      title.className = "menu-title";
      title.textContent = data.menu.title;

      header.appendChild(title);
      menuContainer.appendChild(header);

      // Create category buttons
      const buttonsContainer = document.createElement("div");
      buttonsContainer.className = "menu-category-buttons";

      // Create content container
      const contentContainer = document.createElement("div");
      contentContainer.className = "menu-content";

      // Track active category
      let activeCategory: string | null = null;

      data.menu.categories.forEach(category => {
        const button = createCategoryButton(category);
        const content = createCategoryContent(category);

        button.addEventListener("click", () => {
          // Hide all content
          const allContent = contentContainer.querySelectorAll(".menu-category-content");
          allContent.forEach(c => {
            (c as HTMLElement).style.display = "none";
          });

          // Remove active state from all buttons
          const allButtons = buttonsContainer.querySelectorAll(".menu-category-button");
          allButtons.forEach(b => b.classList.remove("active"));

          if (activeCategory === category.id) {
            // Close if clicking the same category
            activeCategory = null;
          } else {
            // Show selected content
            content.style.display = "block";
            button.classList.add("active");
            activeCategory = category.id;
          }
        });

        buttonsContainer.appendChild(button);
        contentContainer.appendChild(content);
      });

      menuContainer.appendChild(buttonsContainer);
      menuContainer.appendChild(contentContainer);
    })
    .catch(error => {
      loader.innerHTML = `
        <div class="menu-error">
          <h3>Unable to load menu</h3>
          <p>${error.message}</p>
        </div>
      `;
    });

  root.appendChild(menuContainer);
  return root;
}
