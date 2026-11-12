
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  BookOpen,
  Sparkles,
  ArrowRight,
  Star,
  Download,
  ShieldCheck,
  Menu,
  X,
  Heart,
} from "lucide-react";

import { supabase } from "./lib/supabase-client";
import "./App.css";

type CategoryRow = {
  id: string;
  name: string;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  cover_image_url: string | null;
  author: string | null;
  pages: number | null;
  language: string | null;
  status: string;
};

type Product = {
  id: string;
  title: string;
  category: string;
  author: string;
  pages: number | null;
  language: string;
  color: string;
  description: string;
  icon: string;
  tag: string;
  coverImageUrl: string | null;
};

const coverStyles = [
  { color: "lavender", icon: "✦" },
  { color: "blue", icon: "₹" },
  { color: "peach", icon: "✳" },
  { color: "mint", icon: "</>" },
  { color: "pink", icon: "✎" },
  { color: "sand", icon: "↗" },
];

function Storefront() {
  const navigate = useNavigate();
  const UPI_ID = "pdfshelfsupport@axl";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All PDFs");
  const [selected, setSelected] = useState<Product | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);

const handleCopyUpi = async () => {
  try {
    await navigator.clipboard.writeText(UPI_ID);
    setUpiCopied(true);

    setTimeout(() => {
      setUpiCopied(false);
    }, 2500);
  } catch {
    alert("Unable to copy UPI ID. Please copy it manually.");
  }
};

  // Load published products and active categories from Supabase.
  useEffect(() => {
    let active = true;

    async function loadStorefront() {
      setLoading(true);
      setError("");

      try {
        const [productResult, categoryResult] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, title, slug, description, category_id, cover_image_url, author, pages, language, status"
            )
            .eq("status", "published")
            .order("published_at", { ascending: false }),

          supabase
            .from("categories")
            .select("id, name, is_active")
            .eq("is_active", true)
            .order("name"),
        ]);

        if (productResult.error) throw productResult.error;
        if (categoryResult.error) throw categoryResult.error;

        if (!active) return;

        const categoryRows =
          (categoryResult.data ?? []) as CategoryRow[];

        const categoryMap = new Map(
          categoryRows.map((item) => [item.id, item.name])
        );

        const productRows =
          (productResult.data ?? []) as ProductRow[];

        const mappedProducts: Product[] = productRows.map(
          (item, index) => {
            const coverStyle =
              coverStyles[index % coverStyles.length];

            return {
              id: item.id,
              title: item.title,
              category: item.category_id
                ? categoryMap.get(item.category_id) ?? "Uncategorised"
                : "Uncategorised",
              author: item.author || "PDFShelf Editorial",
              pages: item.pages,
              language: item.language || "English",
              color: coverStyle.color,
              description:
                item.description || "Explore this digital resource.",
              icon: coverStyle.icon,
              tag: "",
              coverImageUrl: item.cover_image_url,
            };
          }
        );

        setCategories(categoryRows.map((item) => item.name));
        setProducts(mappedProducts);
      } catch (err) {
        console.error("Storefront loading error:", err);

        if (active) {
          setError(
            "We couldn't load the library right now. Please refresh the page."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStorefront();

    return () => {
      active = false;
    };
  }, []);

  const categoryOptions = ["All PDFs", ...categories];

  // Search and category filtering.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        category === "All PDFs" ||
        product.category === category;

      const matchesSearch =
        `${product.title} ${product.category} ${product.author}`
          .toLowerCase()
          .includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [products, category, search]);

  // Wishlist toggle.
  const toggleWishlist = (id: string) => {
    setWishlist((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  // Download a PDF through the secure Supabase Edge Function.
  const handleFreeDownload = async (product: Product) => {
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("download-pdf", {
          body: {
            productId: product.id,
          },
        });

      if (functionError) {
        throw functionError;
      }

      if (!data?.success || !data?.downloadUrl) {
        throw new Error(
          data?.error ||
            "We couldn't prepare your PDF. Please try again."
        );
      }

      // Open the temporary signed download URL.
      const downloadLink = document.createElement("a");

      downloadLink.href = data.downloadUrl;
      downloadLink.target = "_blank";
      downloadLink.rel = "noopener noreferrer";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

    } catch (downloadError) {
      console.error("PDF download error:", downloadError);

      const message =
        downloadError instanceof Error
          ? downloadError.message
          : "Please try again in a moment.";

      alert(`Unable to download this PDF. ${message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="app">

      {/* Navigation */}
      <header className="navbar">
        <a href="#" className="brand">
  <img
    src="/pdfshelf-icon.png"
    alt="PDFShelf icon"
    className="brand-icon"
  />

  <span>
    PDF<span className="brand-light">Shelf</span>
  </span>
</a>

        <nav
          className={`nav-links ${
            mobileMenu ? "mobile-open" : ""
          }`}
        >
          <a href="#home" onClick={() => setMobileMenu(false)}>
            Home
          </a>

          <a href="#explore" onClick={() => setMobileMenu(false)}>
            Explore PDFs
          </a>

          <a href="#about" onClick={() => setMobileMenu(false)}>
            About us
          </a>
        </nav>

        <div className="nav-actions">
<button
  className="icon-button"
  aria-label="Open wishlist"
  title="My Wishlist"
  onClick={() => setIsWishlistOpen(true)}
>
  <Heart size={19} />

  {wishlist.length > 0 && (
    <span className="count">{wishlist.length}</span>
  )}
</button>

          <button
            className="bag-button"
            onClick={() => setIsSupportOpen(true)}
          >
            <ShoppingBag size={17} />
            <span>Support PDFShelf</span>
          </button>

          <button
            className="mobile-menu-button"
            onClick={() => setMobileMenu((current) => !current)}
            aria-label="Toggle menu"
          >
            {mobileMenu ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main>

        {/* Hero section */}
        <section className="hero" id="home">
          <div className="hero-content">
            <div className="eyebrow">
              <Sparkles size={14} />
              YOUR DIGITAL READING SPACE
            </div>

            <h1>
              Knowledge is just
              <br />
              a <span>page away.</span>
            </h1>

            <p className="hero-description">
              Discover thoughtfully curated digital guides, eBooks
              and resources — all free to download, with optional
              ways to support their creators.
            </p>

            <a href="#explore" className="primary-button">
              Explore collection <ArrowRight size={17} />
            </a>

            <div className="hero-trust">
              <div className="trust-item">
                <ShieldCheck size={17} />
                Free access for everyone
              </div>

              <div className="trust-item">
                <Download size={17} />
                Instant downloads
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="floating-note note-top">
              <Sparkles size={15} />
              Learn something new
            </div>

            <div className="book-stack">
              <div className="book book-back">
                <span>THE ART OF</span>
                <strong>THINKING</strong>
                <small>BETTER EVERY DAY</small>
              </div>

              <div className="book book-middle">
                <span>YOUR GUIDE TO</span>
                <strong>GROWTH.</strong>
                <small>LEARN · CREATE · INSPIRE</small>
              </div>

              <div className="book book-front">
                <div className="book-symbol">✳</div>
                <span>THE DIGITAL</span>
                <strong>LIBRARY</strong>
                <small>A WORLD OF KNOWLEDGE</small>
                <div className="book-bottom">
                  PDFSHELF EDITION
                </div>
              </div>
            </div>

            <div className="floating-note note-bottom">
              <Star size={15} fill="currentColor" />
              Curated for curious minds
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="benefits">
          <div>
            <Download />
            <span>
              <strong>Instant access</strong>
              <small>No payment required</small>
            </span>
          </div>

          <div>
            <ShieldCheck />
            <span>
              <strong>Always free</strong>
              <small>Every PDF is free to download</small>
            </span>
          </div>

          <div>
            <BookOpen />
            <span>
              <strong>Quality resources</strong>
              <small>Useful and curated content</small>
            </span>
          </div>

          <div>
            <Heart />
            <span>
              <strong>Read anywhere</strong>
              <small>Your PDFs, your way</small>
            </span>
          </div>
        </section>

        {/* Collection */}
        <section className="collection" id="explore">
          <div className="section-heading">
            <div>
              <div className="section-kicker">
                OUR COLLECTION
              </div>

              <h2>
                Explore our library<span>.</span>
              </h2>

              <p>
                Find the right resource for your next big idea.
              </p>
            </div>

            <div className="collection-count">
              {loading
                ? "Loading..."
                : `${filteredProducts.length} resources`}
            </div>
          </div>

          {/* Filters and search */}
          <div className="filter-toolbar">
            <div className="category-list">
              {categoryOptions.map((item) => (
                <button
                  key={item}
                  className={`category-chip ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="search-box">
              <Search size={18} />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search resources..."
              />
            </div>
          </div>

          {/* Product cards */}
          <div className="product-grid">

            {loading && (
              <div className="no-results">
                <p>Loading your digital library...</p>
              </div>
            )}

            {!loading && error && (
              <div className="no-results">
                <h3>Unable to load products</h3>
                <p>{error}</p>

                <button
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              filteredProducts.map((product) => (
                <article
                  className="product-card"
                  key={product.id}
                >
                  <div
                    className={`product-cover cover-${product.color}`}
                    onClick={() => setSelected(product)}
                    style={
  product.coverImageUrl
    ? {
        backgroundImage:
          `linear-gradient(rgba(23,36,59,0.04), rgba(23,36,59,0.04)), url("${product.coverImageUrl}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f1eff4",
      }
    : undefined
}
                  >
                    {product.tag && (
                      <span className="product-tag">
                        {product.tag}
                      </span>
                    )}

                    <button
                      className={`wishlist-button ${
                        wishlist.includes(product.id)
                          ? "liked"
                          : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      aria-label="Toggle wishlist"
                    >
                      <Heart
                        size={17}
                        fill={
                          wishlist.includes(product.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>

                    {!product.coverImageUrl && (
                      <div className="cover-design">
                        <div className="cover-mark">
                          {product.icon}
                        </div>

                        <div className="cover-small">
                          {product.category.toUpperCase()}
                        </div>

                        <div className="cover-title">
                          {product.title}
                        </div>

                        <div className="cover-decoration">
                          PDFSHELF EDITION
                        </div>
                      </div>
                    )}

                    <span className="cover-format">PDF</span>
                  </div>

                  <div className="product-info">
                    <div className="product-category">
                      {product.category}
                    </div>

                    <h3 onClick={() => setSelected(product)}>
                      {product.title}
                    </h3>

                    <div className="product-meta">
                      <span>
                        {product.pages
                          ? `${product.pages} pages`
                          : product.language}
                      </span>

                      <span>{product.author}</span>
                    </div>

                    <div className="product-bottom pdf-product-actions">
                      <div className="product-price">
                        <strong>Free</strong>
                        <small>No payment required</small>
                      </div>

                      <div className="pdf-card-buttons">
                        <button
                          className="view-button pdf-read-button"
                          onClick={() => navigate(`/read/${product.id}`)}
                        >
                          <BookOpen size={15} /> Read Online
                        </button>
                        <button
                          className="view-button pdf-download-button"
                          onClick={() => handleFreeDownload(product)}
                          disabled={isDownloading}
                        >
                          <Download size={15} /> Download PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

            {/* Empty search results */}
            {!loading &&
              !error &&
              filteredProducts.length === 0 && (
                <div className="no-results">
                  <Search size={30} />

                  <h3>No resources found</h3>

                  <p>
                    {products.length === 0
                      ? "Our library is being prepared. Please check back soon."
                      : "Try another search or category."}
                  </p>

                  {products.length > 0 && (
                    <button
                      onClick={() => {
                        setSearch("");
                        setCategory("All PDFs");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              )}
          </div>
        </section>

        {/* Newsletter / About */}
        <section className="newsletter" id="about">
          <div>
            <div className="section-kicker">
              STAY INSPIRED
            </div>

            <h2>
              A little knowledge goes a long way.
            </h2>

            <p>
              Discover useful digital resources. Every PDF is
              free, and creator support is always optional.
            </p>
          </div>

          <a href="#explore" className="newsletter-button">
            Browse PDFs <ArrowRight size={17} />
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <a href="#" className="brand">
          <img
  src="/pdfshelf-icon.png"
  alt="PDFShelf icon"
  className="brand-icon"
/>

          <span>
            PDF<span className="brand-light">Shelf</span>
          </span>
        </a>

        <p>
          Making knowledge accessible, one PDF at a time.
        </p>

        <span className="copyright">
          © 2026 PDFShelf. All rights reserved.
        </span>
      </footer>

      {/* Product details modal */}
      {selected && (
        <div
          className="modal-overlay"
          onClick={() => setSelected(null)}
        >
          <div
            className="product-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
            >
              <X size={21} />
            </button>

            <div
              className={`modal-cover cover-${selected.color}`}
              style={
  selected.coverImageUrl
    ? {
        backgroundImage:
          `url("${selected.coverImageUrl}")`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#f1eff4",
      }
    : undefined
}
            >
              {!selected.coverImageUrl && (
                <div className="cover-design">
                  <div className="cover-mark">
                    {selected.icon}
                  </div>

                  <div className="cover-small">
                    {selected.category.toUpperCase()}
                  </div>

                  <div className="cover-title">
                    {selected.title}
                  </div>

                  <div className="cover-decoration">
                    PDFSHELF EDITION
                  </div>
                </div>
              )}
            </div>

            <div className="modal-content">
              <div className="section-kicker">
                {selected.category}
              </div>

              <h2>{selected.title}</h2>

              <div className="modal-rating">
                {selected.pages
                  ? `${selected.pages} pages`
                  : selected.language}
                {" · "}
                {selected.author}
              </div>

              <p>{selected.description}</p>

              <div className="modal-price">
                <strong>Free to download</strong>
              </div>

              {/* Read the PDF online in the built-in reader */}
              <button
                className="view-button pdf-modal-read"
                onClick={() => navigate(`/read/${selected.id}`)}
              >
                <BookOpen size={17} />
                Read Online
              </button>

              {/* Actual free PDF download */}
              <button
                className="primary-button modal-buy"
                onClick={() => handleFreeDownload(selected)}
                disabled={isDownloading}
                aria-busy={isDownloading}
              >
                <Download size={17} />

                {isDownloading
                  ? "Preparing download..."
                  : "Download for Free"}
              </button>

              {/* Optional creator support - contribution integration comes later */}
              <button
                className="view-button"
                style={{
                  width: "100%",
                  marginTop: "10px",
                  justifyContent: "center",
                }}
                onClick={() => setIsSupportOpen(true)}
              >
                <Heart size={17} />
                Support the Creator
              </button>

              <small className="modal-note">
                <ShieldCheck size={14} />
                Every PDF is free. Contributions are optional
                and never required.
              </small>
            </div>
          </div>
        </div>

      )}

      {/* Wishlist popup */}
      {isWishlistOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsWishlistOpen(false)}
        >
          <div
            className="product-modal wishlist-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "520px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "28px",
            }}
          >
            <button
              className="modal-close"
              onClick={() => setIsWishlistOpen(false)}
              aria-label="Close wishlist"
            >
              <X size={21} />
            </button>

            <div className="section-kicker">YOUR COLLECTION</div>
            <h2 style={{ marginBottom: "8px" }}>
              My Wishlist <Heart size={20} fill="currentColor" />
            </h2>
            <p style={{ color: "#697386", marginBottom: "22px" }}>
              {wishlist.length} saved{" "}
              {wishlist.length === 1 ? "PDF" : "PDFs"}
            </p>

            {wishlist.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "35px 15px",
                  color: "#697386",
                }}
              >
                <Heart size={38} style={{ marginBottom: "12px" }} />
                <h3>Your Wishlist is empty</h3>
                <p>Like a PDF to save it here for later.</p>
                <button
                  className="primary-button"
                  style={{ marginTop: "15px" }}
                  onClick={() => setIsWishlistOpen(false)}
                >
                  Explore PDFs
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {products
                  .filter((product) => wishlist.includes(product.id))
                  .map((product) => (
                    <div
                      key={product.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        padding: "12px",
                        border: "1px solid #e9e5ef",
                        borderRadius: "14px",
                        background: "#fff",
                      }}
                    >
                      <div
                        className={`cover-${product.color}`}
                        style={{
                          width: "58px",
                          height: "76px",
                          flexShrink: 0,
                          borderRadius: "7px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          backgroundImage: product.coverImageUrl
                            ? `url("${product.coverImageUrl}")`
                            : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        {!product.coverImageUrl && (
                          <span style={{ fontSize: "24px" }}>
                            {product.icon}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong
                          style={{
                            display: "block",
                            color: "#17243b",
                            fontSize: "14px",
                            marginBottom: "5px",
                          }}
                        >
                          {product.title}
                        </strong>
                        <small style={{ color: "#697386" }}>
                          {product.category} ·{" "}
                          {product.pages
                            ? `${product.pages} pages`
                            : product.language}
                        </small>

                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="view-button"
                            style={{ padding: "7px 11px", fontSize: "12px" }}
                            onClick={() => {
                              setIsWishlistOpen(false);
                              setSelected(product);
                            }}
                          >
                            View details
                          </button>
                          <button
                            className="view-button"
                            style={{
                              padding: "7px 11px",
                              fontSize: "12px",
                              color: "#b34b61",
                            }}
                            onClick={() => toggleWishlist(product.id)}
                          >
                            <Heart size={13} fill="currentColor" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isSupportOpen && (
        <div
          onClick={() => setIsSupportOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(13, 23, 42, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
          className="support-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              background: "#fffdf9",
              borderRadius: "22px",
              padding: "32px 24px",
              width: "100%",
              maxWidth: "420px",
              textAlign: "center",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
              color: "#17243b",
            }}
          >
            <button
              onClick={() => setIsSupportOpen(false)}
              aria-label="Close support popup"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                border: "none",
                background: "#f1eee8",
                borderRadius: "50%",
                width: "34px",
                height: "34px",
                cursor: "pointer",
                fontSize: "20px",
              }}
            >
              ×
            </button>

            <div style={{ color: "#a58bc7", marginBottom: "10px" }}>
              <Heart size={30} fill="currentColor" style={{ margin: "auto" }} />
            </div>

            <div
              style={{
                fontSize: "11px",
                letterSpacing: "2px",
                fontWeight: 700,
                color: "#9b88b5",
                marginBottom: "10px",
              }}
            >
              SUPPORT PDFSHELF
            </div>

            <h2 style={{ fontSize: "26px", margin: "0 0 12px" }}>
              Keep knowledge free.
            </h2>

            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.7,
                color: "#697386",
                marginBottom: "22px",
              }}
            >
              If you enjoy our free resources, you can support PDFShelf with
              a voluntary contribution. Every bit of support is appreciated.
            </p>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9e5ef",
                borderRadius: "16px",
                padding: "16px",
                display: "inline-block",
                marginBottom: "18px",
              }}
            >
              <img
                className="support-qr-image"
                src="/support-qr.png"
                alt="Scan to support PDFShelf using PhonePe UPI"
                style={{
                  display: "block",
                  width: "220px",
                  height: "220px",
                  objectFit: "contain",
                }}
              />
            </div>

            <h3 style={{ fontSize: "16px", margin: "0 0 8px" }}>
              Scan with any UPI app
            </h3>
            
<button
  onClick={handleCopyUpi}
  style={{
    width: "100%",
    padding: "13px",
    marginBottom: "16px",
    border: "1px solid #dcd5e8",
    borderRadius: "12px",
    background: "#f4f0fa",
    color: "#17243b",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  }}
>
  {upiCopied ? "✓ UPI ID Copied!" : "Copy UPI ID"}
</button>


            <p
              style={{
                fontSize: "13px",
                color: "#697386",
                lineHeight: 1.6,
                marginBottom: "20px",
              }}
            >
              Choose any amount you wish to contribute through PhonePe or
              another compatible UPI app.
            </p>

            <button
              onClick={() => setIsSupportOpen(false)}
              style={{
                width: "100%",
                padding: "13px",
                border: "none",
                borderRadius: "12px",
                background: "#17243b",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Continue exploring PDFs
            </button>

            <small
              style={{
                display: "block",
                marginTop: "16px",
                color: "#89909d",
                fontSize: "11px",
              }}
            >
              Contributions are completely optional. All PDFs remain free.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}


export default Storefront;
