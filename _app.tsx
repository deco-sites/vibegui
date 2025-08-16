import { ComponentChildren } from "preact";
import { asset as asset, Head as Head } from "@deco/deco/htmx";
export const Layout = ({ children, revision, hmrUniqueId }: {
  children: ComponentChildren;
  revision: string;
  hmrUniqueId: string;
}) => {
  return (
    <>
      {/* Include Icons and manifest */}
      {/** @ts-ignore: ignore error */}
      <Head>
        {/* Enable View Transitions API */}
        <style
          dangerouslySetInnerHTML={{
            __html: `@view-transition { navigation: auto; }`,
          }}
        />

        {/* Tailwind v3 CSS file */}
        <link
          href={`/styles.css?revision=${revision}${hmrUniqueId}`}
          rel="stylesheet"
        />

        {/* Google Fonts: Pixelify Sans (hero) and Crimson Pro (subtitles/blog headers) */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600&family=Pixelify+Sans:wght@400;500;700&display=swap"
        />

        {/* Web Manifest */}
        <link rel="manifest" href={asset("/site.webmanifest")} />
      </Head>

      {/* Rest of Preact tree */}
      {children}
    </>
  );
};
