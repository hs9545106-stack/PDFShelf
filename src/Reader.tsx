import { useCallback, useEffect, useRef, useState, forwardRef } from "react";
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

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Compatibility cast for react-pageflip's bundled TypeScript definitions.
const CompatibleFlipBook = HTMLFlipBook as any;

type ReaderPageProps = {
  image: string;
  pageNumber: number;
};

const ReaderPage = forwardRef<HTMLDivElement, ReaderPageProps>(
  ({ image, pageNumber }, ref) => (
    <div className="pdf-reader-page" ref={ref}>
      <img src={image} alt={`PDF page ${pageNumber}`} />
      <span className="pdf-page-number">{pageNumber}</span>
    </div>
  )
);
ReaderPage.displayName = "ReaderPage";

export default function Reader() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const flipBookRef = useRef<any>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [title, setTitle] = useState("PDFShelf Reader");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const loadPdf = useCallback(async () => {
    if (!productId) {
      setError("The PDF could not be identified.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setPages([]);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "read-pdf",
        { body: { productId } }
      );

      if (functionError) throw functionError;
      if (!data?.success || !data?.readUrl) {
        throw new Error(data?.error || "Unable to prepare this PDF.");
      }

      setTitle(data.title || "PDFShelf Reader");

      const pdf = await pdfjsLib.getDocument({ url: data.readUrl }).promise;
      const renderedPages: string[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Your browser could not display this PDF.");

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        await page.render({ canvas, canvasContext: context, viewport }).promise;
        renderedPages.push(canvas.toDataURL("image/jpeg", 0.88));
      }

      setPages(renderedPages);
      setCurrentPage(1);
    } catch (loadError) {
      console.error("PDF reader error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to open this PDF. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadPdf();
  }, [loadPdf]);

  const goPrevious = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const goNext = () => flipBookRef.current?.pageFlip()?.flipNext();

  const toggleFullscreen = async () => {
    const element = document.querySelector(".pdf-reader-shell");
    if (!document.fullscreenElement && element instanceof HTMLElement) {
      await element.requestFullscreen?.();
      setFullscreen(true);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  return (
    <main className="pdf-reader-shell">
      <header className="pdf-reader-header">
        <button className="pdf-reader-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> <span>Back to library</span>
        </button>
        <div className="pdf-reader-brand"><BookOpen size={20} /> PDF<span>Shelf</span></div>
        <button className="pdf-reader-download" onClick={() => navigate("/")}>
          <span>Library</span>
        </button>
      </header>

      <section className="pdf-reader-main">
        <div className="pdf-reader-heading">
          <div>
            <div className="pdf-reader-eyebrow">READ ONLINE</div>
            <h1>{title}</h1>
            <p>Enjoy your PDF in the PDFShelf reading experience.</p>
          </div>
          {pages.length > 0 && (
            <div className="pdf-reader-count">{pages.length} pages</div>
          )}
        </div>

        {loading && (
          <div className="pdf-reader-status">
            <LoaderCircle className="pdf-reader-spinner" size={34} />
            <h2>Preparing your reading experience...</h2>
            <p>Loading and rendering the PDF pages. Larger files may take a little longer.</p>
          </div>
        )}

        {!loading && error && (
          <div className="pdf-reader-status pdf-reader-error">
            <BookOpen size={34} />
            <h2>We couldn't open this PDF</h2>
            <p>{error}</p>
            <button className="pdf-reader-primary" onClick={() => void loadPdf()}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
          <>
            <div className="pdf-reader-toolbar">
              <div className="pdf-reader-page-controls">
                <button onClick={goPrevious} disabled={currentPage <= 1} aria-label="Previous page">
                  <ChevronLeft size={19} />
                </button>
                <span>Page <strong>{currentPage}</strong> of {pages.length}</span>
                <button onClick={goNext} disabled={currentPage >= pages.length} aria-label="Next page">
                  <ChevronRight size={19} />
                </button>
              </div>
              <div className="pdf-reader-tools">
                <button onClick={() => setZoom((value) => Math.max(0.75, +(value - 0.1).toFixed(2)))} aria-label="Zoom out">
                  <ZoomOut size={17} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((value) => Math.min(1.5, +(value + 0.1).toFixed(2)))} aria-label="Zoom in">
                  <ZoomIn size={17} />
                </button>
                <button onClick={() => void toggleFullscreen()} aria-label="Toggle fullscreen">
                  {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>
            </div>

            <div
              className="pdf-reader-book-area"
              style={
                zoom === 1
                  ? undefined
                  : ({ transform: `scale(${zoom})`, transformOrigin: "top center" } as CSSProperties)
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
                onFlip={(event: { data: number }) => setCurrentPage(event.data + 1)}
                className="pdf-flip-book"
                style={{ margin: "0 auto" }}
              >
                {pages.map((image, index) => (
                  <ReaderPage key={index} image={image} pageNumber={index + 1} />
                ))}
              </CompatibleFlipBook>
            </div>

            <div className="pdf-reader-bottom-note">
              <span>Tip: Turn pages by clicking the page corner or using the arrows.</span>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
