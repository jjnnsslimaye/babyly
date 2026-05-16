let pendingFirstName = '';
let pendingLastName = '';

export const setPendingGoogleProfile = (firstName: string, lastName: string) => {
  pendingFirstName = firstName;
  pendingLastName = lastName;
};

export const getPendingGoogleProfile = () => ({
  firstName: pendingFirstName,
  lastName: pendingLastName,
});

export const clearPendingGoogleProfile = () => {
  pendingFirstName = '';
  pendingLastName = '';
};
