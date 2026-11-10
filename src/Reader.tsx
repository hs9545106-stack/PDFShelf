
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import HTMLFlipBook from "react-pageflip";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  BookOpen,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { supabase } from "./lib/supabase-client";
import "./App.css";

// Configure PDF.js worker.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Compatibility with react-pageflip TypeScript definitions.
const CompatibleFlipBook = HTMLFlipBook as any;

type ReaderPageProps = {
  image: string;
  pageNumber: number;
};

const ReaderPage = forwardRef<HTMLDivElement, ReaderPageProps>(
  ({ image, pageNumber }, ref) => (
    <div className="pdf-reader-page" ref={ref}>
      <img
        src={image}
        alt={`PDF page ${pageNumber}`}
        draggable={false}
      />
      <span className="pdf-page-number">{pageNumber}</span>
    </div>
  )
);

ReaderPage.displayName = "ReaderPage";

export default function Reader() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const flipBookRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [pages, setPages] = useState<string[]>([]);
  const [title, setTitle] = useState("PDFShelf Reader");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  // Track component mounting.
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load the PDF securely through the Supabase Edge Function.
  const loadPdf = useCallback(async () => {
    if (!productId) {
      setError("The PDF could not be identified.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setPages([]);
    setCurrentPage(1);

    try {
      // Request a temporary signed reading URL.
      const { data, error: functionError } =
        await supabase.functions.invoke("read-pdf", {
          body: { productId },
        });

      if (functionError) {
        throw new Error(
          functionError.message || "Unable to contact the PDF service."
        );
      }

      if (!data?.success || !data?.readUrl) {
        throw new Error(
          data?.error || "The PDF reading link could not be generated."
        );
      }

      if (!mountedRef.current) return;

      setTitle(data.title || "PDFShelf Reader");

      // Fetch the PDF bytes before passing them to PDF.js.
      const response = await fetch(data.readUrl, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Unable to retrieve the PDF. Server returned ${response.status}.`
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (
        contentType &&
        !contentType.includes("application/pdf") &&
        !contentType.includes("application/octet-stream")
      ) {
        throw new Error("The returned file is not a valid PDF.");
      }

      const pdfBytes = new Uint8Array(await response.arrayBuffer());

      if (!pdfBytes.length) {
        throw new Error("The PDF file is empty.");
      }

      // Load PDF from downloaded bytes.
      const loadingTask = pdfjsLib.getDocument({
        data: pdfBytes,
      });

      const pdf = await loadingTask.promise;

      if (!mountedRef.current) {
        
        return;
      }

      const renderedPages: string[] = [];

      // Render each PDF page.
      for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber += 1
      ) {
        if (!mountedRef.current) {
          
          return;
        }

        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({
          scale: 1.35,
        });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error(
            "Your browser could not create a canvas to display the PDF."
          );
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;

        renderedPages.push(
          canvas.toDataURL("image/jpeg", 0.88)
        );

        // Release temporary canvas memory.
        canvas.width = 0;
        canvas.height = 0;

        page.cleanup();
      }

      

      if (!mountedRef.current) return;

      if (renderedPages.length === 0) {
        throw new Error("No pages were found in this PDF.");
      }

      setPages(renderedPages);
      setCurrentPage(1);
      setZoom(1);
    } catch (loadError) {
      console.error("PDFShelf Reader Error:", loadError);

      if (!mountedRef.current) return;

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to open this PDF. Please try again."
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [productId]);

  // Load PDF when the reader route opens.
  useEffect(() => {
    void loadPdf();
  }, [loadPdf]);

  // Page navigation.
  const goPrevious = () => {
    flipBookRef.current?.pageFlip()?.flipPrev();
  };

  const goNext = () => {
    flipBookRef.current?.pageFlip()?.flipNext();
  };

  // Fullscreen mode.
  const toggleFullscreen = async () => {
    try {
      const element = document.querySelector(".pdf-reader-shell");

      if (
        !document.fullscreenElement &&
        element instanceof HTMLElement
      ) {
        await element.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (fullscreenError) {
      console.error("Fullscreen error:", fullscreenError);
    }
  };

  // Keep fullscreen button state synchronized.
  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener(
      "fullscreenchange",
      onFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        onFullscreenChange
      );
    };
  }, []);

  return (
    <main className="pdf-reader-shell">
      {/* Header */}
      <header className="pdf-reader-header">
        <button
          type="button"
          className="pdf-reader-back"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={18} />
          <span>Back to library</span>
        </button>

        <div className="pdf-reader-brand">
          <BookOpen size={20} />
          PDF<span>Shelf</span>
        </div>

        <button
          type="button"
          className="pdf-reader-download"
          onClick={() => navigate("/")}
        >
          <span>Library</span>
        </button>
      </header>

      <section className="pdf-reader-main">
        {/* PDF title */}
        <div className="pdf-reader-heading">
          <div>
            <div className="pdf-reader-eyebrow">
              READ ONLINE
            </div>

            <h1>{title}</h1>

            <p>
              Enjoy your PDF in the PDFShelf reading experience.
            </p>
          </div>

          {pages.length > 0 && (
            <div className="pdf-reader-count">
              {pages.length} pages
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="pdf-reader-status">
            <LoaderCircle
              className="pdf-reader-spinner"
              size={34}
            />

            <h2>Preparing your reading experience...</h2>

            <p>
              Loading and rendering the PDF pages.
              Larger files may take a little longer.
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="pdf-reader-status pdf-reader-error">
            <BookOpen size={34} />

            <h2>We couldn't open this PDF</h2>

            <p>{error}</p>

            <button
              type="button"
              className="pdf-reader-primary"
              onClick={() => void loadPdf()}
            >
              <RefreshCw size={16} />
              Try again
            </button>

            <button
              type="button"
              className="pdf-reader-back"
              onClick={() => navigate("/")}
            >
              <ArrowLeft size={16} />
              Back to library
            </button>
          </div>
        )}

        {/* Reader */}
        {!loading && !error && pages.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="pdf-reader-toolbar">
              <div className="pdf-reader-page-controls">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={19} />
                </button>

                <span>
                  Page <strong>{currentPage}</strong> of{" "}
                  {pages.length}
                </span>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={currentPage >= pages.length}
                  aria-label="Next page"
                >
                  <ChevronRight size={19} />
                </button>
              </div>

              <div className="pdf-reader-tools">
                <button
                  type="button"
                  onClick={() =>
                    setZoom((value) =>
                      Math.max(0.75, +(value - 0.1).toFixed(2))
                    )
                  }
                  aria-label="Zoom out"
                >
                  <ZoomOut size={17} />
                </button>

                <span>{Math.round(zoom * 100)}%</span>

                <button
                  type="button"
                  onClick={() =>
                    setZoom((value) =>
                      Math.min(1.5, +(value + 0.1).toFixed(2))
                    )
                  }
                  aria-label="Zoom in"
                >
                  <ZoomIn size={17} />
                </button>

                <button
                  type="button"
                  onClick={() => void toggleFullscreen()}
                  aria-label="Toggle fullscreen"
                >
                  {fullscreen ? (
                    <Minimize size={17} />
                  ) : (
                    <Maximize size={17} />
                  )}
                </button>
              </div>
            </div>

            {/* Flipbook */}
            <div
              className="pdf-reader-book-area"
              style={
                {
                  "--reader-zoom": zoom,
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                } as CSSProperties
              }
            >
              <CompatibleFlipBook
                ref={flipBookRef}
                width={480}
                height={660}
                size="stretch"
                minWidth={280}
                maxWidth={480}
                minHeight={385}
                maxHeight={660}
                drawShadow={true}
                flippingTime={650}
                usePortrait={true}
                startPage={0}
                autoSize={true}
                maxShadowOpacity={0.28}
                showCover={false}
                mobileScrollSupport={true}
                onFlip={(event: { data: number }) => {
                  setCurrentPage(event.data + 1);
                }}
                className="pdf-flip-book"
                style={{ margin: "0 auto" }}
              >
                {pages.map((image, index) => (
                  <ReaderPage
                    key={index}
                    image={image}
                    pageNumber={index + 1}
                  />
                ))}
              </CompatibleFlipBook>
            </div>

            {/* Bottom tip */}
            <div className="pdf-reader-bottom-note">
              <span>
                Tip: Turn pages by clicking the page corner
                or using the arrows.
              </span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
