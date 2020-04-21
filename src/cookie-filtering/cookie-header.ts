/**
 * Cookie header object
 */
export class CookieHeader {
    /**
     * Cookie name
     */
    name: string;

    /**
     * Cookie value
     */
    value: string;

    /**
     * Cookie path
     */
    path: string | undefined;

    /**
     * Domain for the cookie
     * may begin with "." to indicate the named domain or any subdomain of it
     */
    domain: string | undefined;

    /**
     * Absolute expiration date for the cookie
     */
    expires: Date | undefined;

    /**
     * relative max age of the cookie in seconds from when the client receives it
     */
    maxAge: number | undefined;

    /**
     * indicates that this cookie should only be sent over HTTPs
     */
    secure: boolean | undefined;

    /**
     * indicates that this cookie should not be accessible to client-side JavaScript
     */
    httpOnly: boolean | undefined;

    /**
     * indicates a cookie ought not to be sent along with cross-site requests
     */
    sameSite: string | undefined;

    /**
     * Priority
     */
    priority: string | undefined;

    /**
     * Constructor
     *
     * @param name
     * @param value
     */
    constructor(name: string, value: string) {
        this.name = name;
        this.value = value;
    }
}
