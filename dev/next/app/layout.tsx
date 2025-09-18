export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            // WeakRef polyfill for older browsers/environments
                            if (typeof WeakRef === 'undefined') {
                                window.WeakRef = class WeakRef {
                                    constructor(target) {
                                        this._target = target;
                                    }
                                    
                                    deref() {
                                        return this._target;
                                    }
                                };
                            }
                        `,
                    }}
                />
            </head>
            <body>{children}</body>
        </html>
    )
}
