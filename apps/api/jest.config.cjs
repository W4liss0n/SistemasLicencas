module.exports = {
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/bootstrap.ts']
};
