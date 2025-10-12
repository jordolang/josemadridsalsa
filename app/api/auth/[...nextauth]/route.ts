import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // This is a basic setup - you would typically validate against your database
        if (credentials?.email === "admin@josemadridsalsa.com" && credentials?.password === "admin123") {
          return {
            id: "1",
            email: "admin@josemadridsalsa.com",
            name: "Admin User"
          }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: '/auth/signin'
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }