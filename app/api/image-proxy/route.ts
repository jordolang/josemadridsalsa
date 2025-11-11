import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow Google Places images
  if (!imageUrl.startsWith('https://places.googleapis.com/')) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'Referer': 'https://www.josemadrid.net',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      // Return a placeholder or error image
      return new NextResponse(null, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
