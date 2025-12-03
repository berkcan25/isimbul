# İsimBul - Turkish Name Explorer

**İsimBul** is an interactive, data-driven web application designed to explore the etymology, statistical usage, and semantic relationships of Turkish names. It features a modern dashboard, and a complex force-directed graph to visualize how names are connected by meaning. Also, features a favorites list to save your favorite names.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![React](https://img.shields.io/badge/React-v19-blue)
![Tailwind](https://img.shields.io/badge/Style-Tailwind_CSS-38bdf8)

## Features

### Discovery & Analysis
* **Advanced Search & Filtering:** Filter names by gender, linguistic origin (Arabic, Turkish, Farsi, etc.), and Quranic status.
* **Dual View Modes:** Toggle between a data-rich **Table View** and a visual **Grid View**.
* **Detailed Analytics:** View usage statistics over key historical periods (post-1923, post-1980, post-2008).

### Interactive Cluster Graph
* **Semantic Visualization:** A 2D force-directed graph (`react-force-graph-2d`) grouping names by semantic meaning.
* **Customizable Visualization:** Color nodes by Origin, Gender, or Meaning. Adjust node sizes dynamically.

### User Experience
* **Personalization:** "Like" names to save them to your local Favorites list.
* **Bilingual Support:** Full support for **Turkish (TR)** and **English (EN)** via Context API.
* **Dark Mode:** Fully responsive dark/light theme toggling.
* **SEO Optimized:** Uses React 19 native metadata for dynamic titles and descriptions.
* **Social Sharing:** Native Web Share API integration to easily share name cards.
* **Discovery:** "Random Name" button to stumble upon new names.

## Tech Stack

* **Framework:** [React 19](https://react.dev/)
* **Routing:** [React Router DOM](https://reactrouter.com/)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Visualization:**
    * [Recharts](https://recharts.org/) (Bar charts)
    * [React Force Graph](https://github.com/vasturiano/react-force-graph) (Network visualization)
* **State Management:** React Context API (Theme, Language, Likes)

Screenshots:
The main panel:
<img width="2788" height="1463" alt="image" src="https://github.com/user-attachments/assets/0e868a09-9600-46cf-9afe-4efe3f194609" />

Name details:
<img width="2606" height="1523" alt="image" src="https://github.com/user-attachments/assets/5a05cdf2-ece4-4c56-98d6-bdee0acb36ef" />

The graph visualization:
<img width="3299" height="1597" alt="image" src="https://github.com/user-attachments/assets/c9e51402-1ea4-4b71-8bfc-dc57595e61f3" />


## Project Structure

```bash
src/
├── components/       # Reusable UI components (SearchableSelect, etc.)
├── context/          # Context Providers (Theme, Language, Likes)
├── data/             # Static name data (namesData.js)
├── pages/            # Main Page Views
│   ├── About.jsx     # Credits & Info
│   ├── ClusterView.jsx # Force Graph visualization
│   ├── LikedNames.jsx # Favorites list
│   ├── NameDetail.jsx # Specific name stats & charts
│   └── NameList.jsx   # Main dashboard
└── App.jsx           # Main entry point & Routing
````

## Getting Started

1.  **Clone the repository**

    ```bash
    git clone [https://github.com/yourusername/isimbul.git](https://github.com/yourusername/isimbul.git)
    cd isimbul
    ```

2.  **Install dependencies**

    ```bash
    npm install
    ```

3.  **Run the development server**

    ```bash
    npm run dev
    ```

4.  **Build for production**

    ```bash
    npm run build
    ```

## Data Sources & Credits

This project relies on etymological data and definitions to provide accurate context.

  * **Primary Data Source:** [Nişanyan Adlar](https://www.nisanyanadlar.com)
      * The etymological data, name definitions, and historical context used in this project are sourced from the invaluable work of **Sevan Nişanyan**.
  * **Usage Statistics:** Aggregated from public naming frequency datasets.

## Contributing

Contributions are welcome\! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
