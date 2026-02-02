import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || 'tim@example.com'
  const password = process.argv[3] || 'changeme123'
  
  console.log('Creating admin account...')
  console.log(`Email: ${email}`)
  
  // Check if admin already exists
  const existing = await prisma.admin.findUnique({
    where: { email },
  })
  
  if (existing) {
    console.log('Admin with this email already exists. Updating password...')
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.admin.update({
      where: { email },
      data: { 
        passwordHash,
        password: password, // Store plain text for Isaac Mode
      },
    })
    console.log('Admin password updated!')
  } else {
    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.admin.create({
      data: {
        email,
        passwordHash,
        password: password, // Store plain text for Isaac Mode
        name: 'Tim',
      },
    })
    console.log('Admin created successfully!')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })