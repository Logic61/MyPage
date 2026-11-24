# Mountain study artwork

The entrance gate carries two vertical inscriptions in [Zhi Mang Xing](https://github.com/googlefonts/zhimangxing) (SIL Open Font License). `gate-couplet-cut.webp` contains just the fourteen rasterized characters and their carved edges. Each panel samples one half of the image for both the cut and its celadon glow.

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

The 2172 × 724 WebP depicts granite pinnacles in morning haze. The separate cloud-pass-granite.webp image is an original generated stone colour texture for the island cliffs. See the [architectural concept and site plan](../../docs/design/cloud-pass-study.webp).

### 3D integration

`landscape-backdrop.ts` maps one image across 180 degrees of a 108 m radius cylinder and mirrors the geometry's U coordinates across the other half. Its height is `π × radius / 3` (about 113.1 m), preserving the 3:1 ratio along each half-circumference. The distant ridgeline is calibrated at 46% from the image top and placed at world y=25.5 m, so mountains remain visible through the windows and above the terrace rail. These dimensions keep the geometry within the default 230 m camera far plane.

The local texture is sRGB with `flipY=true`, `repeat=[1,1]` and clamped UV sampling. Ordinary `MeshBasicMaterial` uses the same tone mapping as the rest of the scene. A separate linear alpha map softens the sky/cloud edges and mirror folds. The upper edge blends into the sky canopy. Two translucent surfaces at y=-11 m and -17 m carry a tileable cloud density field on independent wind currents. Their perimeter fades into the mountain painting.

All background objects are excluded from interaction picking, physics and the ambient-occlusion depth pass. Geometry, a gradient sky and a Canvas landscape are available from the first frame. The mountain and sky images load independently. Textures arriving after scene disposal are released.

## Blue sky above the courtyard

`cloud-court-sky.webp` is an original ImageGen painting created for MyPage on 2026-11-23. The brief called for an upward view with softly lit white cumulus, fine cirrus across the zenith and a pale outer sky to match the blue-green mountains. The 1254 × 1254 painting is delivered as a 108,300-byte sRGB WebP.

The centre of the painting maps directly overhead. Angular distance from the zenith sets the sampling radius, which gives every azimuth the same centre texel and blends the lower part of the canopy into the horizon. The high clouds drift gently. Local mist rolls around the cliff below eye level. The cloud layers freeze in place while reading and when reduced motion is enabled.

## Lotus leaf detail

`lotus-leaf.webp` is an original ImageGen diffuse texture generated on 2026-11-23. Its central hub and branching veins follow the radial UVs of the cupped lotus blades. The 1254 px square source is delivered at 640 px in a 58,912-byte WebP. The raised flower stalks, layered petals and conical seed heads are modelled in geometry. [Royal Botanic Gardens, Kew, sacred lotus](https://www.kew.org/plants/sacred-lotus)

The pine geometry takes its spreading boughs from Chinese red pine. The root flare and leader define the trunk width, and each successively finer branch takes its starting radius from its parent at the attachment. [International Dendrology Society, Pinus tabuliformis](https://www.treesandshrubsonline.org/articles/pinus/pinus-tabuliformis/)

## Courtyard architecture and vegetation

The gate, hall, galleries, paired pavilions and planted courts use original, metre-scale geometry. The architectural reference was the raised central hall, double eaves and red timber seen at Wudang. [Zixiao Palace field photographs](https://wlt.hubei.gov.cn/bmdt/mtjj/202208/t20220810_4255672.shtml)

| Delivered asset | Source and use |
| --- | --- |
| cloud-crane-frieze.webp | Original built-in ImageGen painting. The 2172 × 724 original was cropped to its painted band and encoded at 1280 px wide. The beam UVs allocate a pair of cranes to each painted panel. |
| pine-bough.webp | Original built-in ImageGen botanical cutout. The alpha channel is retained in the 960 px WebP. Each blade cluster bends around its twig attachment. |
| court-stone.webp | 512 px cool stone derived from the Meridian Observatory's CC0 limestone blend. [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001), [Aerial Rocks 02](https://polyhaven.com/a/aerial_rocks_02) |
| honed-limestone.webp | 768 px warm matte paving stone. The mineral grain uses the same CC0 court-stone source with a pale ochre grade, fine pores and calcite bands. |
| oiled-elm.webp | 768 px timber floor albedo with lengthwise vessels, growth bands and restrained wear from the lacquer-grain source below. |
| lacquer-grain.webp | 512 px greyscale modulation for red lacquer derived from the Meridian Observatory timber map. [Wood Table Worn](https://polyhaven.com/a/wood_table_worn), [Poly Haven CC0 licence](https://polyhaven.com/license) |

### Crane frieze prompt

> Use case: historical-scene. Make a single wide flat painted texture for the front of a traditional Chinese Daoist hall's timber architrave in a first-person mountain courtyard. A continuous horizontal decorative band in Wudang Ming architectural polychromy, two small elegant ivory red-crowned cranes flying in opposite sweeping poses between long, interlacing ruyi cloud scrolls and low malachite mountain crests. Broad winding cloud lines in ochre gold, soft jade, faded cinnabar and chalk white over a deep petrol-teal ground. Balanced breathing space, disciplined period brushwork, a sense of movement, finely mineral-pigmented wood with very faint weathering, softly aged gold thin parallel borders on the top and bottom. Edge-to-edge decoration, flat orthographic face-on artwork, wide landscape canvas, ideally 4:1, motifs arranged in a single shallow horizontal band across the center so the art can be displayed on a beam. Even diffuse color only. No black surrounds, margins, illustrations of a building, lighting effects, text, lettering, symbols resembling characters, border around the sides, photographs or perspective.

### Pine bough prompt

> Botanical game foliage texture on a genuinely transparent background. One isolated fine bough of a real Chinese mountain pine (Pinus hwangshanensis), a cutout for an elegant Chinese landscape in a Three.js game. A slender crooked, tapering reddish-grey woody twig starts at the middle left edge and grows to the right. Five to eight unequal upward-forking twigs along it. Each carries distinct irregular tufts of long paired ink-green fine needles, with a little warm sage light on the tips. Clearly visible open transparent gaps between the tufts and around every outside needle. Overall silhouette a narrow horizontal fan, broader in the middle, natural asymmetry. View slightly from above, legible branch structure, realistic botanical illustration with delicately painted tonal detail, diffuse soft daylight, soft jade and olive greens. Landscape 3:2 canvas, centered vertically, full bough with minimal margins at its left and right tips. Natural fine tapered tuft silhouettes, no field of solid overlapping leaves, no shadow on ground, no backdrop, no other branches, cones, text or border.

## Hanging scroll, roof and pine surfaces

The wall-mounted *Preface* uses `folio-pines.webp`, an original ImageGen painting made for MyPage. The art direction was a horizontal ink landscape on warm paper, with a weathered pine, a small tiled roof at the left, pale mountain washes and open paper to the right. The delivery file is 1280 px wide. The name, Chinese or English title and seal are drawn separately so visitors can read the appropriate inscription. The reader's paper grain (`folio-paper.webp`) is the original Meridian Observatory vellum, copied byte for byte with its parchment panel, catalogue layout and wooden rollers from commit `6a423a1`. The mounting takes inspiration from the silk borders and turned wooden roller of historical hanging scrolls. [Smithsonian National Museum of Asian Art, mounting Chinese paintings](https://archive.asia.si.edu/exhibitions/online/anportcon/mounting.htm)

| Delivered maps | Origin and treatment |
| --- | --- |
| `pine-bark-color.webp`, `pine-bark-normal.webp`, `pine-bark-rough.webp` | Dimitrios Savva's photographic Pine Bark scan. The diffuse is lightly desaturated. The normal is in OpenGL format. [Poly Haven, Pine Bark](https://polyhaven.com/a/pine_bark) |
| `fired-tile-grain.webp`, `fired-tile-rough.webp` | Stephan Seeliger's Roof Tiles scan, graded to modulate the green-grey ceramic. Overlaps, lips and tile ends are geometry. [Poly Haven, Roof Tiles](https://polyhaven.com/a/roof_tiles) |
| `timber-normal.webp`, `timber-rough.webp` | Resampled from the Meridian Observatory copy of Wood Table Worn for the lacquered timber. [Poly Haven, Wood Table Worn](https://polyhaven.com/a/wood_table_worn) |
| `limewash-color.webp`, `limewash-normal.webp` | Meridian Observatory's Beige Wall 001 maps, resized and graded for the courtyard lime plaster. [Poly Haven, Beige Wall 001](https://polyhaven.com/a/beige_wall_001) |
| `flagstone-normal.webp` | Resized from the Meridian Observatory copy of Paving Stones 150. [ambientCG, Paving Stones 150](https://ambientcg.com/view?id=PavingStones150) |

The source scans are CC0. The site serves these WebP maps locally. Colour maps use sRGB and normal and roughness maps use linear data. [Poly Haven licence](https://polyhaven.com/license), [ambientCG licence](https://docs.ambientcg.com/license/)

## Courtyard music

The speaker starts a weighted draw at track boundaries. The previous recording is excluded from the next draw. Each file is the original AAC stream remuxed for progressive playback.

| Recording | Draw weight | Source |
| --- | ---: | --- |
| Beethoven, Pastoral Symphony | 4 | [Bilibili recording](https://www.bilibili.com/video/BV1Bx411t7xW/) |
| Chopin, Barcarolle, Op. 60 | 4 | [Bilibili recording, starting at 00:20](https://www.bilibili.com/video/BV1gb411G74B/) |
| 江上清风游 | 2 | [Bilibili recording](https://www.bilibili.com/video/BV14s411i7vZ/) |
| 烟雨行舟 | 2 | [Bilibili recording](https://www.bilibili.com/video/BV1z54y1S7qv/) |
| Heart linked | 1 | [Bilibili recording](https://www.bilibili.com/video/BV18s411c7yF/) |

The courtyard pines use a straight leader and layered, spreading boughs, informed by the [China National Botanical Garden's Chinese pine photographs](https://chnbg.cn/shu_detail/737.html).
