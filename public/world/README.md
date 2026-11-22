# Mountain study artwork

`mountain-silk-landscape.webp` is an original image generated for this project's circular landscape screen on 2026-11-22 using ChatGPT's built-in `imagegen` tool. It is a decorative painting texture, not a photograph, scan of a historical work, or rendering of the finished room. No reference image was supplied.

The generated 1254 × 1254 PNG was converted to lossless WebP for delivery (2,503,137 → 1,656,420 bytes). Decoded RGB pixels were checked to be identical. The original generated PNG remains in the image-generation output, outside the repository. The application uses this single WebP as an sRGB, `flipY=true` albedo map on a non-emissive PBR silk material. A procedural Canvas landscape remains visible if local image loading fails.

## Generation prompt

> Use case: stylized-concept. Asset type: a square 2D painting texture for the silk centre of a real circular screen in a 3D mountain study. Create an original, refined Chinese landscape ink-and-light-colour painting inspired by Song-dynasty shan shui, viewed perfectly front-on as a flat artwork. Layer distant pale blue-grey and ink-teal mountains with open cloud and mist, a few delicately drawn small pines, nuanced mineral washes and very fine restrained brushwork on softly warm ivory silk. Quiet, cultivated, spacious composition; about half the surface should remain airy pale mist and negative space. The major composition must remain complete inside a centred circular crop occupying 92% of the square: keep essential mountain peaks, tiny pines and focal rock forms away from the square corners. Colours: cool pale jade-blue, grey-green, restrained ink-blue, ivory silk that is not yellow or sepia. The entire image is ONLY the flat painted artwork, evenly lit and suitable to map onto a 3D surface. No frame, no circular border, no scroll rods, no furniture or room, no 3D rendering, no perspective, no realistic photographic landscape, no title, no lettering, no calligraphy, no seal, no signature, no watermark. Square composition, subtle fine silk texture, elegant museum-quality painting.

## Provenance and use

This file was generated specifically for MyPage with no reference image or stock-image source. This note records the generation method and the exact prompt used.

## Immortal mountains panorama

`immortal-mountains-panorama.webp` is the separate 3:1 environment image for the outdoor cloud-courtyard horizon. The original circular silk painting above remains unchanged.

### Generation record

The panorama was created specifically for MyPage with the built-in `image_gen` tool and no reference image or stock-image source. It is a fantasy environment matte painting rather than a photograph of a real place. The exact prompt is preserved in [immortal-mountains-prompt.txt](./immortal-mountains-prompt.txt).

The generated PNG is **2172 × 724 pixels**, exactly 3:1, and **2,116,399 bytes**. Its lossless WebP delivery copy is **1,503,338 bytes**. Decoded RGB pixels were compared and are identical; this is a format conversion with no crop, resize or visual alteration. The generated PNG remains in the image-generation output outside the repository.

### 3D integration

`landscape-backdrop.ts` maps one image across 180 degrees of a 108 m radius cylinder and mirrors the geometry's U coordinates across the other half. Its height is `π × radius / 3` (about 113.1 m), preserving the 3:1 ratio along each half-circumference. The image horizon, 30% from the top, is placed at world y=1.5 m. These dimensions keep the geometry within the default 230 m camera far plane.

The local texture is sRGB with `flipY=true`, `repeat=[1,1]` and clamped UV sampling. Ordinary `MeshBasicMaterial` uses the same tone mapping as the rest of the scene. A separate linear alpha map softens the sky/cloud edges and mirror folds. A closed gradient sky sphere and two translucent cloud surfaces at y=-11 m and -17 m complete the background above and below the island.

All background objects are excluded from interaction picking, physics and the ambient-occlusion depth pass. Geometry and a Canvas landscape fallback are available synchronously; the `ready` promise only replaces the colour map. Load failures keep the fallback, and resource disposal also covers textures that finish loading after the scene closes.
