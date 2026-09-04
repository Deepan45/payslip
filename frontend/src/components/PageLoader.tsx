import logo from "../assets/logo.png";

/** Full-section branded loading state — pulsing logo in a spinning ring, centered. Used while a page's primary data is loading. */
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="page-loader">
      <span className="page-loader-ring">
        <img src={logo} alt="" className="page-loader-logo" />
      </span>
      <span className="page-loader-text">{message}</span>
    </div>
  );
}
