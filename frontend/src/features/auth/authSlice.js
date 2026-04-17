import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import client from "../../api/client";

export const login = createAsyncThunk("auth/login", async (payload, thunkApi) => {
  try {
    const response = await client.post("/auth/login", payload);
    return response.data;
  } catch (error) {
    return thunkApi.rejectWithValue(error.response?.data?.message || "Login failed");
  }
});

const initialToken = localStorage.getItem("token");
const initialAdminRaw = localStorage.getItem("admin");

const parseInitialAdmin = () => {
  if (!initialAdminRaw) {
    return null;
  }

  try {
    const parsed = JSON.parse(initialAdminRaw);
    return {
      ...parsed,
      role: parsed?.role || "admin",
      isActive: parsed?.isActive !== false,
    };
  } catch (_error) {
    return null;
  }
};

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: initialToken,
    admin: parseInitialAdmin(),
    loading: false,
    error: null,
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.admin = null;
      state.error = null;
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.admin = {
          ...(action.payload.admin || {}),
          role: action.payload?.admin?.role || "admin",
          isActive: action.payload?.admin?.isActive !== false,
        };
        localStorage.setItem("token", action.payload.token);
        localStorage.setItem("admin", JSON.stringify(state.admin));
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
