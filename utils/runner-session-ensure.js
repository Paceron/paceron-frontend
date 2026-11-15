export function createRunnerSessionEnsurer(create) {
  let pending = null;
  return () => {
    if (!pending) {
      try {
        pending = Promise.resolve(create()).catch((error) => {
          pending = null;
          throw error;
        });
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return pending;
  };
}
