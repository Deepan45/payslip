import logo from "../assets/logo.png";

/** Branded loading indicator — pulsing logo with a spinning ring, for longer-running operations. */
export function BrandLoader({ message }: { message: string }) {
  return (
    <div className="brand-loader">
      <span className="brand-loader-ring">
        <img src={logo} alt="" className="brand-loader-logo" />
      </span>
      <span>{message}</span>
    </div>
  );
}
