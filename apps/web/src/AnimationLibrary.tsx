import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "./api";
import {
  ANIMATIONS_EMPTY_DESCRIPTION,
  ANIMATIONS_EMPTY_TITLE,
  ANIMATIONS_ERROR_MESSAGE,
  ANIMATIONS_PACKS_EMPTY,
  ANIMATIONS_PAGE_DESCRIPTION,
  animationsPageState,
  type AnimationPackRecord,
} from "./animationData";
import type { AssetRecord } from "./assetData";

export function AnimationLibrary() {
  const [packs, setPacks] = useState<AnimationPackRecord[] | null>(null);
  const [assets, setAssets] = useState<AssetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [packPayload, assetPayload] = await Promise.all([
        api<{ items: AnimationPackRecord[] }>("/v1/animation-packs"),
        api<{ items: AssetRecord[] }>("/v1/assets"),
      ]);
      setPacks(Array.isArray(packPayload.items) ? packPayload.items : []);
      setAssets(Array.isArray(assetPayload.items) ? assetPayload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setPacks(null);
      setAssets(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(ANIMATIONS_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = animationsPageState({ loading, error, packs, assets });

  if (page.kind === "loading") {
    return (
      <>
        <h1>Animations</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        <h1>Animations</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Animations</h1>
          <p className="muted page-lead">{ANIMATIONS_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      <p>
        <Link className="pp-btn pp-btn--link" to="/assets">
          Assets
        </Link>
      </p>
      <section aria-labelledby="lottie-assets-heading">
        <h2 id="lottie-assets-heading">Lottie assets</h2>
        {page.lottieEmpty ? (
          <div className="empty-state">
            <h2>{ANIMATIONS_EMPTY_TITLE}</h2>
            <p className="muted">{ANIMATIONS_EMPTY_DESCRIPTION}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Animation</th>
                    <th scope="col">Size</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {page.lottie.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.sizeLabel}</td>
                      <td>
                        <Link className="pp-btn pp-btn--link" to={row.href}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="stack-list">
              {page.lottie.map((row) => (
                <li key={row.id}>
                  <article>
                    <h2>{row.name}</h2>
                    <dl>
                      <dt>Size</dt>
                      <dd>{row.sizeLabel}</dd>
                    </dl>
                    <Link className="pp-btn pp-btn--link" to={row.href}>
                      Open
                    </Link>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="media-section" aria-labelledby="animation-packs-heading">
        <h2 id="animation-packs-heading">Animation packs</h2>
        <p className="muted">Pack availability depends on your plan.</p>
        {page.packsEmpty ? (
          <p className="muted">{ANIMATIONS_PACKS_EMPTY}</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Pack</th>
                    <th scope="col">Category</th>
                    <th scope="col">Access</th>
                  </tr>
                </thead>
                <tbody>
                  {page.packs.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.category}</td>
                      <td>{row.accessLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="stack-list">
              {page.packs.map((row) => (
                <li key={row.id}>
                  <article>
                    <h2>{row.name}</h2>
                    <dl>
                      <dt>Category</dt>
                      <dd>{row.category}</dd>
                      <dt>Access</dt>
                      <dd>{row.accessLabel}</dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
